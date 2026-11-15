import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "#/mocks/node";
import {
  setActiveSelection,
  setRegisteredBackends,
} from "#/api/backend-registry/active-store";
import { useFolderHasGitHistory } from "#/hooks/query/use-folder-has-git-history";

const host = "http://localhost:9878";
const FOLDER = "/Users/jane/projects/foo";
let requests = 0;

const answerCommits = (response: () => Response) =>
  server.use(
    http.get(`${host}/api/git/commits`, () => {
      requests += 1;
      return response();
    }),
  );

const commitsPage = (count: number) =>
  HttpResponse.json({
    commits: Array.from({ length: count }, () => ({
      sha: "a".repeat(40),
      short_sha: "aaaaaaa",
      subject: "init",
      author: "Jane",
      timestamp: "2026-11-01T00:00:00Z",
    })),
    has_more: false,
  });

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

const renderProbe = (path: string | null, enabled = true) =>
  renderHook(() => useFolderHasGitHistory(path, enabled), { wrapper });

describe("useFolderHasGitHistory", () => {
  beforeEach(() => {
    requests = 0;
    setRegisteredBackends([
      { id: "probe", name: "Probe", kind: "local", host, apiKey: "k" },
    ]);
    setActiveSelection({ backendId: "probe" });
  });

  it.each([
    ["a folder with commits", () => commitsPage(1), true],
    ["an empty page", () => commitsPage(0), false],
    [
      "a server without the commits route",
      () => new HttpResponse(null, { status: 404 }),
      false,
    ],
  ])("resolves %s to %s", async (_label, response, expected) => {
    answerCommits(response);
    const { result } = renderProbe(FOLDER);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(expected);
  });

  it("surfaces a server error once, without retrying", async () => {
    answerCommits(() => new HttpResponse(null, { status: 500 }));
    const { result } = renderProbe(FOLDER);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(requests).toBe(1);
  });

  it.each([
    ["disabled", FOLDER, false],
    ["missing a folder", null, true],
  ] as const)("does not probe when %s", async (_label, path, enabled) => {
    answerCommits(() => commitsPage(1));
    const { result } = renderProbe(path, enabled);
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toBe(0);
  });
});
