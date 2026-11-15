import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  removeStoredConversationMetadata,
  setStoredConversationMetadata,
  type WorkspaceMode,
} from "#/api/conversation-metadata-store";
import { NavigationProvider } from "#/context/navigation-context";

const useActiveConversationMock = vi.fn();
const mutateAsync = vi.fn();

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => useActiveConversationMock(),
}));
vi.mock("#/hooks/query/use-agent-profiles", () => ({
  useAgentProfiles: () => ({
    data: {
      profiles: [
        { id: "profile-a", name: "A" },
        { id: "profile-b", name: "B" },
      ],
      active_agent_profile_id: "profile-a",
    },
    isLoading: false,
  }),
}));
vi.mock("#/hooks/mutation/use-create-conversation", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("#/hooks/mutation/use-create-conversation")
  >()),
  useCreateConversation: () => ({ mutateAsync }),
}));
vi.mock(
  "#/hooks/mutation/use-activate-agent-profile",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("#/hooks/mutation/use-activate-agent-profile")
    >()),
    useActivateAgentProfile: () => ({ mutate: vi.fn() }),
  }),
);

// eslint-disable-next-line import/first
import { useChatInputProfileState } from "#/hooks/use-chat-input-profile-state";

const CONVERSATION_ID = "conv-1";
const FOLDER = "/Users/jane/projects/foo";
const navigate = vi.fn();

const renderState = () => {
  const queryClient = new QueryClient();
  return renderHook(() => useChatInputProfileState(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <NavigationProvider
          value={{
            currentPath: `/conversations/${CONVERSATION_ID}`,
            conversationId: CONVERSATION_ID,
            isNavigating: false,
            navigate,
          }}
        >
          {children}
        </NavigationProvider>
      </QueryClientProvider>
    ),
  });
};

const switchProfile = async (conversation: {
  tags?: Record<string, string>;
  selected_workspace?: string | null;
}) => {
  useActiveConversationMock.mockReturnValue({
    data: {
      conversation_id: CONVERSATION_ID,
      launched_agent_profile: { agent_profile_id: "profile-a" },
      ...conversation,
    },
    isLoading: false,
  });
  const { result } = renderState();
  act(() => {
    result.current.selectProfile({ id: "profile-b", name: "B" } as never);
  });
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/conversations/new-conv"),
  );
  return mutateAsync.mock.lastCall?.[0];
};

describe("useChatInputProfileState profile switch", () => {
  beforeEach(() => {
    mutateAsync.mockReset().mockResolvedValue({ conversation_id: "new-conv" });
    navigate.mockReset();
  });

  afterEach(() => {
    removeStoredConversationMetadata(CONVERSATION_ID);
  });

  it.each(["docker_container", "docker_worktree"] as const)(
    "relaunches a tagged %s conversation on its folder in the same mode",
    async (mode) => {
      const variables = await switchProfile({
        tags: { workspacemode: mode },
        selected_workspace: FOLDER,
      });
      expect(variables).toMatchObject({
        agentProfileId: "profile-b",
        workingDir: FOLDER,
        workspaceMode: mode,
      });
    },
  );

  it("relaunches a tagged Docker conversation without a folder in Docker", async () => {
    const variables = await switchProfile({
      tags: { workspacemode: "docker_container" },
    });
    expect(variables.workingDir).toBeUndefined();
    expect(variables.workspaceMode).toBe("docker_container");
  });

  it.each(["local_repo", "new_worktree"] as const)(
    "relaunches a host conversation in its stored %s mode",
    async (mode: WorkspaceMode) => {
      setStoredConversationMetadata(CONVERSATION_ID, {
        selected_repository: null,
        selected_branch: null,
        git_provider: null,
        selected_workspace: FOLDER,
        workspace_mode: mode,
      });
      const variables = await switchProfile({ selected_workspace: FOLDER });
      expect(variables).toMatchObject({
        workingDir: FOLDER,
        workspaceMode: mode,
      });
    },
  );

  it("relaunches a folder conversation without a recorded mode in place", async () => {
    const variables = await switchProfile({ selected_workspace: FOLDER });
    expect(variables.workspaceMode).toBe("local_repo");
  });
});
