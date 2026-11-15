import { useQuery } from "@tanstack/react-query";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { folderHasGitHistory } from "#/api/conversation-workspace";

/**
 * Whether a picked host folder can host a Docker Worktree (a git repo with at
 * least one commit). The service re-checks at start, so a pending probe is
 * not a refusal.
 */
export function useFolderHasGitHistory(
  path: string | null | undefined,
  enabled: boolean,
) {
  const { backend } = useActiveBackend();
  return useQuery({
    queryKey: ["folder-git-history", backend.id, backend.host, path],
    queryFn: () => folderHasGitHistory(path as string),
    enabled: enabled && !!path,
    retry: false,
    staleTime: 30_000,
    meta: { disableToast: true },
  });
}
