import i18n from "#/i18n";
import { I18nKey } from "#/i18n/declaration";
import { ServerClient } from "@openhands/typescript-client/clients";
import {
  getAgentServerClientOptions,
  type AgentServerClientOverrides,
} from "./agent-server-client-options";
import type { ServerRuntimes } from "#/utils/workspace-mode";
import {
  AgentServerUnavailableError,
  getCachedAgentServerInfo,
  type AgentServerInfo,
} from "./agent-server-compatibility";
import {
  buildConversationWorkingDirForBackend,
  getWorkspaceRootForBackend,
} from "./agent-server-config";
import { resolveAbsoluteAgentServerPath } from "./agent-server-home";

const ISOLATED_WORKSPACE_DIR = "/workspace";

/** A Docker-only server: a server that also offers `local` is not isolated. */
export function usesIsolatedWorkspace(
  info: AgentServerInfo | null | undefined,
): boolean {
  return (
    info?.conversation_runtime === "docker" &&
    !info.available_conversation_runtimes?.includes("local")
  );
}

/** Whether a start request may pick `conversation_runtime: "docker"`. */
export function supportsDockerConversations(
  info: AgentServerInfo | null | undefined,
): boolean {
  return !!info?.available_conversation_runtimes?.includes("docker");
}

export async function getConversationServerInfo(
  overrides: AgentServerClientOverrides = {},
): Promise<AgentServerInfo | null> {
  const options = getAgentServerClientOptions(overrides);
  const cached = getCachedAgentServerInfo({ host: options.host });
  if (cached) return cached;
  try {
    return await new ServerClient(options).getServerInfo();
  } catch {
    // An unreachable or non-responding agent-server is not fatal: callers
    // fall back to host-workspace behavior, matching how the rest of the
    // app treats an unavailable `server_info` (see
    // `fetchBackendServerInfo`). Only a *successful* probe that reports
    // `conversation_runtime: "docker"` may isolate the workspace.
    return null;
  }
}

export function getServerRuntimes(
  info: AgentServerInfo | null | undefined,
): ServerRuntimes {
  if (usesIsolatedWorkspace(info)) return "docker_only";
  if (supportsDockerConversations(info)) return "hybrid";
  return "host_only";
}

/** Start paths fail closed: without `server_info` the runtime is unknown. */
export async function requireConversationServerInfo(): Promise<AgentServerInfo> {
  const info = await getConversationServerInfo();
  if (!info) throw new AgentServerUnavailableError();
  return info;
}

export async function resolveNewConversationWorkspace(options: {
  conversationId: string;
  info: AgentServerInfo;
  workingDir?: string;
  selectedRepository?: string | null;
  inContainer?: boolean;
}) {
  const clientOptions = getAgentServerClientOptions();
  const { info } = options;
  const isolated = usesIsolatedWorkspace(info);
  if (isolated) {
    if (options.selectedRepository) {
      throw new Error(i18n.t(I18nKey.HOME$ISOLATED_WORKSPACE_NOTICE));
    }
    if (options.workingDir === undefined) {
      return {
        workingDir: ISOLATED_WORKSPACE_DIR,
        hooksProjectDir: null,
        isolated: true,
      };
    }
  }
  // @spec WUP-001 — Resolve relative local defaults against the backend home.
  const base =
    options.workingDir ??
    buildConversationWorkingDirForBackend(
      options.conversationId,
      clientOptions.host,
    );
  const workingDir = await resolveAbsoluteAgentServerPath(base);
  const inContainer = isolated || !!options.inContainer;
  // The Docker runtime mounts a host `working_dir` at /workspace, except the
  // literal /workspace, which becomes a new empty sandbox.
  if (inContainer && workingDir === ISOLATED_WORKSPACE_DIR) {
    throw new Error(i18n.t(I18nKey.HOME$DOCKER_WORKSPACE_PATH_RESERVED));
  }
  // A container sees only the folder the user attached, so only its hooks apply.
  let hooksProjectDir: string | null;
  if (!inContainer) {
    hooksProjectDir = await resolveHooksProjectDir(
      options.workingDir,
      clientOptions.host,
    );
  } else {
    hooksProjectDir = options.workingDir === undefined ? null : workingDir;
  }
  return { workingDir, hooksProjectDir, isolated };
}

/**
 * Workspace root whose `.openhands/hooks.json` a host-workspace conversation
 * loads: the folder the user attached, else the backend's workspace root,
 * never the per-conversation working dir or worktree (#16907).
 */
function resolveHooksProjectDir(
  selectedWorkspace: string | null | undefined,
  host: string,
): Promise<string> {
  return resolveAbsoluteAgentServerPath(
    selectedWorkspace || getWorkspaceRootForBackend(host),
  );
}

/**
 * The hooks project dir of an existing conversation, resolved as
 * `resolveNewConversationWorkspace()` resolved it at start from the workspace
 * the user attached. A container conversation (every conversation on an
 * isolated backend) sees only that folder, so without one it has no hooks.
 */
export async function resolveConversationHooksProjectDir(
  selectedWorkspace: string | null | undefined,
  inContainer = false,
): Promise<string | null> {
  const clientOptions = getAgentServerClientOptions();
  if (
    inContainer ||
    usesIsolatedWorkspace(await getConversationServerInfo(clientOptions))
  ) {
    return selectedWorkspace && selectedWorkspace !== ISOLATED_WORKSPACE_DIR
      ? resolveAbsoluteAgentServerPath(selectedWorkspace)
      : null;
  }
  return resolveHooksProjectDir(selectedWorkspace, clientOptions.host);
}
