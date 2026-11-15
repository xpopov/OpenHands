import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "#/mocks/node";
import {
  setActiveSelection,
  setRegisteredBackends,
} from "#/api/backend-registry/active-store";
import {
  folderHasGitHistory,
  supportsDockerWorktree,
} from "#/api/conversation-workspace";
import type { AgentServerInfo } from "#/api/agent-server-compatibility";

const host = "http://localhost:9877";

const serverInfo = (fields: Partial<AgentServerInfo>): AgentServerInfo => ({
  uptime: 1,
  idle_time: 0,
  version: "",
  ...fields,
});

describe("supportsDockerWorktree", () => {
  it.each([
    ["1.61.0", true],
    ["1.61.1", true],
    ["1.62.0", true],
    ["2.0.0", true],
    ["1.60.2", false],
    ["1.61.0-rc1", false],
    ["1.61.0.dev0", false],
    ["not-a-version", false],
  ])("version %s -> %s", (version, expected) => {
    expect(supportsDockerWorktree(serverInfo({ version }))).toBe(expected);
  });

  it("falls back to sdk_version", () => {
    expect(supportsDockerWorktree(serverInfo({ sdk_version: "1.61.0" }))).toBe(
      true,
    );
  });

  it.each([null, undefined, serverInfo({})])(
    "treats %j as unsupported",
    (info) => {
      expect(supportsDockerWorktree(info)).toBe(false);
    },
  );
});

describe("folderHasGitHistory", () => {
  const requested: string[] = [];

  const answerCommits = (response: () => Response) =>
    server.use(
      http.get(`${host}/api/git/commits`, ({ request }) => {
        const url = new URL(request.url);
        requested.push(url.pathname + url.search);
        return response();
      }),
    );

  beforeEach(() => {
    requested.length = 0;
    setRegisteredBackends([
      { id: "probe", name: "Probe", kind: "local", host, apiKey: "k" },
    ]);
    setActiveSelection({ backendId: "probe" });
  });

  it("asks the host server for one commit of the folder", async () => {
    answerCommits(() =>
      HttpResponse.json({
        commits: [
          {
            sha: "a".repeat(40),
            short_sha: "aaaaaaa",
            subject: "init",
            author: "Jane",
            timestamp: "2026-11-01T00:00:00Z",
          },
        ],
        has_more: false,
      }),
    );
    await expect(folderHasGitHistory("/Users/jane/projects/foo")).resolves.toBe(
      true,
    );
    expect(requested).toEqual([
      "/api/git/commits?path=%2FUsers%2Fjane%2Fprojects%2Ffoo&limit=1",
    ]);
  });

  it("is false for a non-repo or an unborn HEAD (empty page)", async () => {
    answerCommits(() => HttpResponse.json({ commits: [], has_more: false }));
    await expect(folderHasGitHistory("/Users/jane/notes")).resolves.toBe(false);
  });

  it("is false when the server has no commits route", async () => {
    answerCommits(() => new HttpResponse(null, { status: 404 }));
    await expect(folderHasGitHistory("/Users/jane/notes")).resolves.toBe(false);
  });
});
