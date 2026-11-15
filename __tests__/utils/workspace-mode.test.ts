import { describe, expect, it } from "vitest";
import type { WorkspaceMode } from "#/api/conversation-metadata-store";
import {
  getDefaultWorkspaceMode,
  getWorkspaceModeOptions,
  isContainerWorkspaceMode,
  isWorkspaceMode,
  isWorktreeWorkspaceMode,
  planConversationRuntime,
  type ParentRuntime,
  type ServerRuntimes,
} from "#/utils/workspace-mode";

const HOST_MODES: WorkspaceMode[] = ["local_repo", "new_worktree"];
const ALL_MODES: WorkspaceMode[] = [...HOST_MODES, "docker_container"];

const plan = (
  overrides: Partial<Parameters<typeof planConversationRuntime>[0]>,
) =>
  planConversationRuntime({
    hasWorkingDir: true,
    server: "hybrid",
    allowLocal: true,
    parent: "none",
    ...overrides,
  });

const DOCKER = {
  ok: true,
  plan: {
    mode: "docker_container",
    conversationRuntime: "docker",
    worktree: false,
    inContainer: true,
  },
};

const hostPlan = (
  mode: WorkspaceMode,
  conversationRuntime: "local" | undefined,
) => ({
  ok: true,
  plan: {
    mode,
    conversationRuntime,
    worktree: mode === "new_worktree",
    inContainer: false,
  },
});

describe("planConversationRuntime", () => {
  it.each(["none", "host"] as const)(
    "P1: refuses a container on a host-only server (parent %s)",
    (parent) => {
      expect(
        plan({
          server: "host_only",
          parent,
          requestedMode: "docker_container",
        }),
      ).toEqual({ ok: false, refusal: "docker_unavailable" });
    },
  );

  it.each(HOST_MODES)(
    "P2: keeps host mode %s on a host-only server without a runtime",
    (requestedMode) => {
      expect(
        plan({ server: "host_only", allowLocal: false, requestedMode }),
      ).toEqual(hostPlan(requestedMode, undefined));
    },
  );

  it.each(["host", "container"] as const)(
    "P3: refuses any %s-parent child on a Docker-only server",
    (parent) => {
      for (const requestedMode of ALL_MODES) {
        expect(plan({ server: "docker_only", parent, requestedMode })).toEqual({
          ok: false,
          refusal: "docker_parent",
        });
      }
    },
  );

  it.each(ALL_MODES)(
    "P4: refuses a %s child of a container parent on a hybrid server",
    (requestedMode) => {
      expect(plan({ parent: "container", requestedMode })).toEqual({
        ok: false,
        refusal: "docker_parent",
      });
    },
  );

  it("P5: refuses a container child of a host parent", () => {
    expect(plan({ parent: "host", requestedMode: "docker_container" })).toEqual(
      { ok: false, refusal: "docker_parent" },
    );
  });

  it.each(HOST_MODES)(
    "P6: refuses a %s child when local conversations are off",
    (requestedMode) => {
      expect(
        plan({ parent: "host", allowLocal: false, requestedMode }),
      ).toEqual({ ok: false, refusal: "local_disallowed" });
    },
  );

  it.each(HOST_MODES)(
    "P7: starts a %s child of a host parent on the local runtime",
    (requestedMode) => {
      expect(plan({ parent: "host", requestedMode })).toEqual(
        hostPlan(requestedMode, "local"),
      );
    },
  );

  it.each([undefined, ...ALL_MODES])(
    "P9: maps requested mode %s to Docker without a worktree on a Docker-only server",
    (requestedMode) => {
      expect(
        plan({ server: "docker_only", requestedMode, hasWorkingDir: false }),
      ).toEqual(DOCKER);
    },
  );

  it("P10: starts a requested container on a hybrid server", () => {
    expect(plan({ requestedMode: "docker_container" })).toEqual(DOCKER);
  });

  it.each(HOST_MODES)(
    "P11: starts %s on the local runtime when local conversations are on",
    (requestedMode) => {
      expect(plan({ requestedMode })).toEqual(hostPlan(requestedMode, "local"));
    },
  );

  it.each(HOST_MODES)(
    "P12: starts Docker instead of %s when local conversations are off",
    (requestedMode) => {
      expect(plan({ requestedMode, allowLocal: false })).toEqual(DOCKER);
    },
  );

  it.each([
    [true, "local_repo"],
    [false, "new_worktree"],
  ] as const)(
    "defaults an unset mode with a folder=%s to %s",
    (hasWorkingDir, mode) => {
      expect(plan({ hasWorkingDir })).toEqual(hostPlan(mode, "local"));
    },
  );

  it("never asks a container for a worktree", () => {
    const servers: ServerRuntimes[] = ["host_only", "docker_only", "hybrid"];
    const parents: ParentRuntime[] = ["none", "host", "container"];
    for (const requestedMode of [undefined, ...ALL_MODES])
      for (const hasWorkingDir of [true, false])
        for (const server of servers)
          for (const allowLocal of [true, false])
            for (const parent of parents) {
              const result = planConversationRuntime({
                requestedMode,
                hasWorkingDir,
                server,
                allowLocal,
                parent,
              });
              if (!result.ok) continue;
              expect(
                result.plan.worktree &&
                  result.plan.conversationRuntime === "docker",
              ).toBe(false);
              expect(result.plan.inContainer).toBe(
                result.plan.conversationRuntime === "docker",
              );
              expect(server !== "host_only" && parent === "container").toBe(
                false,
              );
            }
  });
});

describe("getWorkspaceModeOptions", () => {
  it.each([
    [true, true, true, ["local_repo", "new_worktree", "docker_container"]],
    [true, false, true, ["local_repo", "new_worktree"]],
    [false, true, true, ["docker_container"]],
    [false, false, true, []],
    [true, true, false, ["local_repo", "docker_container"]],
    [true, false, false, []],
    [false, true, false, ["docker_container"]],
    [false, false, false, []],
  ] as const)(
    "local=%s docker=%s folder=%s offers %j",
    (local, docker, hasWorkspace, expected) => {
      expect(getWorkspaceModeOptions({ local, docker, hasWorkspace })).toEqual(
        expected,
      );
    },
  );
});

describe("getDefaultWorkspaceMode", () => {
  it.each([
    ["docker", "new_worktree", ALL_MODES, "docker_container"],
    ["local", "new_worktree", ALL_MODES, "local_repo"],
    ["docker", "new_worktree", HOST_MODES, "new_worktree"],
    [undefined, "new_worktree", ALL_MODES, "new_worktree"],
    ["toString", "new_worktree", ALL_MODES, "new_worktree"],
    ["local", "new_worktree", ["docker_container"], "docker_container"],
    [null, "local_repo", ["docker_container"], "docker_container"],
    [null, "docker_container", [], "local_repo"],
  ] as const)(
    "saved %s, last used %s, offered %j -> %s",
    (saved, lastUsed, options, expected) => {
      expect(getDefaultWorkspaceMode(saved, lastUsed, options)).toBe(expected);
    },
  );

  it("skips disabled modes", () => {
    expect(
      getDefaultWorkspaceMode("docker", "docker_container", ALL_MODES, [
        "docker_container",
      ]),
    ).toBe("local_repo");
  });
});

describe("workspace mode predicates", () => {
  it.each([
    ["local_repo", false, false],
    ["new_worktree", false, true],
    ["docker_container", true, false],
    [null, false, false],
    [undefined, false, false],
  ] as const)("%s: container=%s worktree=%s", (mode, container, worktree) => {
    expect(isContainerWorkspaceMode(mode)).toBe(container);
    expect(isWorktreeWorkspaceMode(mode)).toBe(worktree);
  });

  it.each([
    ["local_repo", true],
    ["new_worktree", true],
    ["docker_container", true],
    ["docker", false],
    ["", false],
    [null, false],
    [undefined, false],
  ] as const)("isWorkspaceMode(%s) is %s", (value, expected) => {
    expect(isWorkspaceMode(value)).toBe(expected);
  });
});
