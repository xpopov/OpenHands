import { useQuery } from "@tanstack/react-query";
import { useActiveBackend } from "#/contexts/active-backend-context";
import {
  getConversationServerInfo,
  supportsDockerConversations,
  supportsDockerWorktree,
  usesIsolatedWorkspace,
} from "#/api/conversation-workspace";

export function useConversationWorkspace() {
  const { backend } = useActiveBackend();
  const query = useQuery({
    queryKey: [
      "conversation-workspace",
      backend.id,
      backend.host,
      backend.connectionRevision,
    ],
    queryFn: () => getConversationServerInfo(),
    enabled: backend.kind === "local" && !!backend.host,
    staleTime: 60_000,
    retry: false,
    meta: { disableToast: true },
  });
  const isolated =
    backend.kind === "local" && usesIsolatedWorkspace(query.data);
  const dockerSelectable =
    backend.kind === "local" && supportsDockerConversations(query.data);
  return {
    isolated,
    dockerSelectable,
    dockerAvailable: isolated || dockerSelectable,
    dockerWorktreeSupported:
      backend.kind === "local" && supportsDockerWorktree(query.data),
    serverInfoLoading: query.isLoading,
    // Docker conversations mount an attached host folder, so pickers stay on.
    unsupportedMessage: null,
  };
}
