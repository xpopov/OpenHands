import type { BackendKind } from "#/api/backend-registry/types";
import type { WorkspaceMode } from "#/api/conversation-metadata-store";
import { I18nKey } from "#/i18n/declaration";

export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = "local_repo";

const HOST_WORKSPACE_MODES: WorkspaceMode[] = ["local_repo", "new_worktree"];

export const ALL_WORKSPACE_MODES: readonly WorkspaceMode[] = [
  ...HOST_WORKSPACE_MODES,
  "docker_container",
];

/**
 * The modes the launcher offers: host modes when the conversation may run on
 * the host, Docker when the server can run it. Without a workspace there is
 * no repo to work in or branch, so the only choice left is where it runs.
 */
export function getWorkspaceModeOptions(available: {
  local: boolean;
  docker: boolean;
  hasWorkspace: boolean;
}): WorkspaceMode[] {
  const { local, docker, hasWorkspace } = available;
  if (!hasWorkspace) {
    if (!docker) return [];
    return local ? ["local_repo", "docker_container"] : ["docker_container"];
  }
  return [
    ...(local ? HOST_WORKSPACE_MODES : []),
    ...(docker ? (["docker_container"] as const) : []),
  ];
}

const MODE_BY_DEFAULT_RUNTIME: Record<string, WorkspaceMode> = {
  local: "local_repo",
  worktree: "new_worktree",
  docker: "docker_container",
};

/**
 * The mode the launcher starts on: the Settings → Runtime default
 * (`conversation_settings.default_runtime`), else the last one used in this
 * browser, else the first mode offered; each only if offered and enabled.
 */
export function getDefaultWorkspaceMode(
  defaultRuntime: unknown,
  lastUsed: WorkspaceMode,
  options: readonly WorkspaceMode[],
  disabled: readonly WorkspaceMode[] = [],
): WorkspaceMode {
  const usable = (mode: WorkspaceMode | undefined): mode is WorkspaceMode =>
    !!mode && options.includes(mode) && !disabled.includes(mode);
  const saved =
    typeof defaultRuntime === "string" &&
    Object.hasOwn(MODE_BY_DEFAULT_RUNTIME, defaultRuntime)
      ? MODE_BY_DEFAULT_RUNTIME[defaultRuntime]
      : undefined;
  return [saved, lastUsed, ...options].find(usable) ?? DEFAULT_WORKSPACE_MODE;
}

export const LAST_LOCAL_WORKSPACE_MODE_STORAGE_KEY =
  "openhands-last-local-workspace-mode";

export function isWorkspaceMode(
  value: string | null | undefined,
): value is WorkspaceMode {
  return (
    value === "local_repo" ||
    value === "new_worktree" ||
    value === "docker_container"
  );
}

export function isContainerWorkspaceMode(
  mode: WorkspaceMode | null | undefined,
): boolean {
  return mode === "docker_container";
}

export function isWorktreeWorkspaceMode(
  mode: WorkspaceMode | null | undefined,
): boolean {
  return mode === "new_worktree";
}

/** Conversation tag recording a container conversation's mode for other browsers. */
export const WORKSPACE_MODE_TAG_KEY = "workspacemode";

export type ServerRuntimes = "host_only" | "docker_only" | "hybrid";
export type ParentRuntime = "none" | "host" | "container";
export type RuntimePolicyRefusal =
  | "docker_unavailable"
  | "docker_parent"
  | "local_disallowed";

export interface RuntimePlan {
  mode: WorkspaceMode;
  conversationRuntime?: "local" | "docker";
  worktree: boolean;
  inContainer: boolean;
}

export type RuntimePlanResult =
  | { ok: true; plan: RuntimePlan }
  | { ok: false; refusal: RuntimePolicyRefusal };

export class ConversationRuntimePolicyError extends Error {
  readonly code: RuntimePolicyRefusal;

  constructor(code: RuntimePolicyRefusal, message: string) {
    super(message);
    this.name = "ConversationRuntimePolicyError";
    this.code = code;
  }
}

export const isConversationRuntimePolicyError = (
  error: unknown,
): error is ConversationRuntimePolicyError =>
  error instanceof ConversationRuntimePolicyError;

const hostPlan = (
  mode: WorkspaceMode,
  conversationRuntime: "local" | undefined,
): RuntimePlanResult => ({
  ok: true,
  plan: {
    mode,
    conversationRuntime,
    worktree: mode === "new_worktree",
    inContainer: false,
  },
});

const DOCKER_PLAN: RuntimePlanResult = {
  ok: true,
  plan: {
    mode: "docker_container",
    conversationRuntime: "docker",
    worktree: false,
    inContainer: true,
  },
};

/**
 * Where a new conversation runs, decided once for every Canvas start path.
 * A container never receives `worktree: true`, a child or planner never
 * leaves a container for the host, and a server without a local runtime
 * gets Docker even for a host mode recorded elsewhere.
 */
export function planConversationRuntime(input: {
  requestedMode?: WorkspaceMode;
  hasWorkingDir: boolean;
  server: ServerRuntimes;
  allowLocal: boolean;
  parent: ParentRuntime;
}): RuntimePlanResult {
  const requested =
    input.requestedMode ??
    (input.hasWorkingDir ? "local_repo" : "new_worktree");
  const wantsContainer = isContainerWorkspaceMode(requested);

  if (input.server === "host_only") {
    return wantsContainer
      ? { ok: false, refusal: "docker_unavailable" }
      : hostPlan(requested, undefined);
  }
  if (input.parent === "container") {
    return { ok: false, refusal: "docker_parent" };
  }
  if (input.server === "docker_only") {
    return input.parent === "none"
      ? DOCKER_PLAN
      : { ok: false, refusal: "docker_parent" };
  }
  if (wantsContainer) {
    return input.parent === "none"
      ? DOCKER_PLAN
      : { ok: false, refusal: "docker_parent" };
  }
  if (input.allowLocal) return hostPlan(requested, "local");
  return input.parent === "none"
    ? DOCKER_PLAN
    : { ok: false, refusal: "local_disallowed" };
}

export function readStoredLocalWorkspaceMode(): WorkspaceMode {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_MODE;

  try {
    const stored = window.localStorage.getItem(
      LAST_LOCAL_WORKSPACE_MODE_STORAGE_KEY,
    );
    return isWorkspaceMode(stored) ? stored : DEFAULT_WORKSPACE_MODE;
  } catch {
    return DEFAULT_WORKSPACE_MODE;
  }
}

export function writeStoredLocalWorkspaceMode(mode: WorkspaceMode): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LAST_LOCAL_WORKSPACE_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures; the selector still works for this render.
  }
}

export function getWorkspaceModeI18nKey(
  mode: WorkspaceMode,
  backendKind: BackendKind,
): I18nKey {
  if (mode === "new_worktree") {
    return I18nKey.COMMON$WORKSPACE_MODE_NEW_WORKTREE;
  }
  if (mode === "docker_container") {
    return I18nKey.COMMON$WORKSPACE_MODE_DOCKER_CONTAINER;
  }
  return backendKind === "cloud"
    ? I18nKey.COMMON$WORKSPACE_MODE_CLOUD_REPO
    : I18nKey.COMMON$WORKSPACE_MODE_LOCAL_REPO;
}
