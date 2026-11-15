import i18n from "#/i18n";
import { I18nKey } from "#/i18n/declaration";
import AgentServerGitService from "#/api/git-service/agent-server-git-service.api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "#/mocks/node";
import {
  setRegisteredBackends,
  setActiveSelection,
} from "#/api/backend-registry/active-store";
import { clearCachedAgentServerInfo } from "#/api/agent-server-compatibility";
import { clearAgentServerHomeDirCache } from "#/api/agent-server-home";
import {
  requireConversationServerInfo,
  resolveConversationHooksProjectDir,
  resolveNewConversationWorkspace,
} from "#/api/conversation-workspace";
import SettingsService from "#/api/settings-service/settings-service.api";
import type { Settings } from "#/types/settings";
import { ConversationRuntimePolicyError } from "#/utils/workspace-mode";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import AgentServerRuntimeService from "#/api/runtime-service/agent-server-runtime-service";

const host = "http://localhost:9876";
const cid = "11111111-1111-4111-8111-111111111111";
const paths: string[] = [];
let isolated = true;
let capabilities = true;

const resolveWorkspace = async (
  options: Omit<
    Parameters<typeof resolveNewConversationWorkspace>[0],
    "conversationId" | "info"
  >,
) =>
  resolveNewConversationWorkspace({
    conversationId: cid,
    info: await requireConversationServerInfo(),
    ...options,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  isolated = true;
  capabilities = true;
  paths.length = 0;
  clearCachedAgentServerInfo();
  clearAgentServerHomeDirCache();
  setRegisteredBackends([
    {
      id: "boundary",
      name: "Boundary",
      kind: "local",
      host,
      apiKey: "boundary-test-key",
    },
  ]);
  setActiveSelection({ backendId: "boundary" });
  // Only the HTTP server is substituted; frontend services and SDK clients run unchanged.
  server.use(
    http.all(`${host}/*`, ({ request }) => {
      const url = new URL(request.url);
      paths.push(url.pathname + url.search);
      expect(request.headers.get("X-Session-API-Key")).toBe(
        "boundary-test-key",
      );
      if (url.pathname === "/server_info")
        return HttpResponse.json({
          version: "1.45.0",
          uptime: 0,
          idle_time: 0,
          capabilities: capabilities ? ["conversation_runtime_routes_v1"] : [],
          conversation_runtime: isolated ? "docker" : "local",
          runtime_services: { mode: isolated ? "dev:automation" : "docker" },
        });
      if (url.pathname === "/api/file/home")
        return HttpResponse.json({ home: "/home/agent" });
      if (url.pathname === "/api/conversations")
        return HttpResponse.json([
          {
            id: cid,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            execution_status: "idle",
            workspace: { working_dir: "/workspace" },
          },
        ]);
      if (url.pathname.endsWith("/git/changes"))
        return HttpResponse.json([{ path: "file.txt", status: "M" }]);
      if (url.pathname.endsWith("/git/diff"))
        return HttpResponse.json({ original: "before", modified: "after" });
      if (url.pathname.endsWith("/file/download"))
        return HttpResponse.text("plan contents");
      if (url.pathname.endsWith("/bash/execute_bash_command"))
        return HttpResponse.json({
          exit_code: 0,
          stdout: "/workspace",
          stderr: "",
        });
      return HttpResponse.json(
        { error: "Unexpected endpoint" },
        { status: 500 },
      );
    }),
  );
});

describe("conversation runtime boundaries", () => {
  it("scopes live unified git calls even before conversation URL hydration", async () => {
    expect(
      await AgentServerGitService.getGitChanges(cid, null, null, "/workspace"),
    ).toHaveLength(1);
    expect(
      await AgentServerGitService.getGitChangeDiff(cid, null, null, "file.txt"),
    ).toEqual({ original: "before", modified: "after" });
    expect(paths).toContain(
      `/api/conversations/${cid}/git/changes?path=%2Fworkspace`,
    );
    expect(paths).toContain(`/api/conversations/${cid}/git/diff?path=file.txt`);
  });

  it("uses a new isolated workspace without reading host home or hooks", async () => {
    expect(await resolveWorkspace({})).toEqual({
      workingDir: "/workspace",
      hooksProjectDir: null,
      isolated: true,
    });
    expect(paths).toEqual(["/server_info"]);
  });

  it("lists no hooks for an isolated conversation without a folder", async () => {
    expect(await AgentServerConversationService.getHooks(cid)).toEqual({
      hooks: [],
    });
    expect(paths).toEqual(["/server_info"]);
  });

  it.each([
    ["/home/user/project", "/home/user/project"],
    ["relative/project", "/home/agent/relative/project"],
  ])(
    "mounts selected host folder %s and reads its hooks",
    async (workingDir, absolute) => {
      expect(await resolveWorkspace({ workingDir })).toEqual({
        workingDir: absolute,
        hooksProjectDir: absolute,
        isolated: true,
      });
    },
  );

  it.each([true, false])(
    "refuses /workspace as a container folder (isolated server: %s)",
    async (serverIsolated) => {
      isolated = serverIsolated;
      await expect(
        resolveWorkspace({ workingDir: "/workspace", inContainer: true }),
      ).rejects.toThrow(i18n.t(I18nKey.HOME$DOCKER_WORKSPACE_PATH_RESERVED));
    },
  );

  it("reads hooks from the folder of a container run on a hybrid server", async () => {
    isolated = false;
    expect(
      await resolveWorkspace({
        workingDir: "/home/user/project",
        inContainer: true,
      }),
    ).toEqual({
      workingDir: "/home/user/project",
      hooksProjectDir: "/home/user/project",
      isolated: false,
    });
  });

  it("reads no hooks for a container run without a folder on a hybrid server", async () => {
    isolated = false;
    expect(
      (await resolveWorkspace({ inContainer: true })).hooksProjectDir,
    ).toBeNull();
  });

  it.each([
    ["/home/user/project", true, true, "/home/user/project"],
    ["/home/user/project", false, true, "/home/user/project"],
    [null, true, false, null],
    [null, false, true, null],
    ["/workspace", false, true, null],
  ] as const)(
    "resolves the hooks dir of %s (container %s, isolated server %s)",
    async (folder, inContainer, serverIsolated, expected) => {
      isolated = serverIsolated;
      expect(
        await resolveConversationHooksProjectDir(folder, inContainer),
      ).toBe(expected);
    },
  );

  it("rejects selected host repository metadata", async () => {
    await expect(
      resolveWorkspace({
        selectedRepository: "owner/project",
      }),
    ).rejects.toThrow(i18n.t(I18nKey.HOME$ISOLATED_WORKSPACE_NOTICE));
  });

  it("uses the active language for workspace rejection errors", async () => {
    const originalLanguage = i18n.language;
    const notice = "Ce backend utilise des espaces de travail isolés.";
    i18n.addResourceBundle("fr", "openhands", {
      [I18nKey.HOME$ISOLATED_WORKSPACE_NOTICE]: notice,
    });
    try {
      await i18n.changeLanguage("fr");
      await expect(
        resolveWorkspace({
          selectedRepository: "owner/project",
        }),
      ).rejects.toThrow(notice);
    } finally {
      await i18n.changeLanguage(originalLanguage);
    }
  });

  it("refuses a child on a Docker-only server", async () => {
    vi.spyOn(SettingsService, "getSettings").mockResolvedValue({} as Settings);
    const start = AgentServerConversationService.createConversation({
      agentProfileId: "profile-1",
      workingDirOverride: "/workspace",
      parentConversationId: "parent",
    });
    await expect(start).rejects.toBeInstanceOf(ConversationRuntimePolicyError);
    await expect(start).rejects.toMatchObject({
      code: "docker_parent",
      message: i18n.t(I18nKey.CONVERSATION$DOCKER_PARENT_UNSUPPORTED),
    });
    expect(
      paths.filter((path) => path.startsWith("/api/conversations")),
    ).toEqual([]);
  });

  it("uses host metadata rather than runtime_services deployment mode", async () => {
    isolated = false;
    expect(
      await resolveWorkspace({
        workingDir: "/home/user/project",
      }),
    ).toEqual({
      workingDir: "/home/user/project",
      hooksProjectDir: "/home/user/project",
      isolated: false,
    });
  });

  it("routes plan downloads and runtime bash to the same conversation", async () => {
    expect(await AgentServerConversationService.readConversationFile(cid)).toBe(
      "plan contents",
    );
    expect(
      await AgentServerRuntimeService.executeCommand(
        `${host}/api/conversations/${cid}`,
        null,
        "pwd",
        "/workspace",
      ),
    ).toMatchObject({ stdout: "/workspace" });
    expect(paths).toContain(
      `/api/conversations/${cid}/file/download?path=%2Fworkspace%2F.agents_tmp%2FPLAN.md`,
    );
    expect(paths).toContain(
      `/api/conversations/${cid}/bash/execute_bash_command`,
    );
  });

  it("retains cid for legacy servers without canonical capability", async () => {
    capabilities = false;
    await AgentServerGitService.getGitChangeDiff(cid, null, null, "file.txt");
    expect(paths).toContain(`/api/git/diff?path=file.txt&cid=${cid}`);
  });
});
