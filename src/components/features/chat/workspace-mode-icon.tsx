import { GitBranch } from "lucide-react";
import { FaDocker } from "react-icons/fa6";
import type { WorkspaceMode } from "#/api/conversation-metadata-store";
import RepoForkedIcon from "#/icons/repo-forked.svg?react";

export function WorkspaceModeIcon({ mode }: { mode: WorkspaceMode }) {
  if (mode === "new_worktree") {
    return <GitBranch className="size-3" strokeWidth={2} aria-hidden />;
  }
  if (mode === "docker_container") {
    return <FaDocker className="size-3" aria-hidden />;
  }
  if (mode === "docker_worktree") {
    return (
      <span className="relative inline-flex size-3" aria-hidden>
        <FaDocker className="size-3" />
        <GitBranch
          className="absolute -right-1 -bottom-1 size-2 rounded-full bg-surface"
          strokeWidth={3}
        />
      </span>
    );
  }

  return <RepoForkedIcon width={12} height={12} aria-hidden />;
}
