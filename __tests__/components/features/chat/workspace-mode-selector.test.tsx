import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WorkspaceModeSelector } from "#/components/features/chat/workspace-mode-selector";
import { I18nKey } from "#/i18n/declaration";

const ALL_MODES = [
  "local_repo",
  "new_worktree",
  "docker_container",
  "docker_worktree",
] as const;
const option = (mode: string) =>
  screen.getByTestId(`workspace-mode-selector-option-${mode}`);

describe("WorkspaceModeSelector", () => {
  it("opens the menu and calls onChange when an option is selected", () => {
    const onChange = vi.fn();
    render(
      <WorkspaceModeSelector
        value="local_repo"
        options={["local_repo", "new_worktree"]}
        backendKind="local"
        onChange={onChange}
      />,
    );

    // Open the menu (trigger renders the active mode via WorkspaceModeIcon).
    fireEvent.click(screen.getByTestId("workspace-mode-selector"));
    fireEvent.click(
      screen.getByTestId("workspace-mode-selector-option-new_worktree"),
    );

    expect(onChange).toHaveBeenCalledWith("new_worktree");
  });

  it("shows a hint line under both Docker rows and none under host rows", () => {
    render(
      <WorkspaceModeSelector
        value="local_repo"
        options={[...ALL_MODES]}
        backendKind="local"
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-mode-selector"));

    expect(option("docker_container")).toHaveTextContent(
      I18nKey.COMMON$WORKSPACE_MODE_DOCKER_HINT,
    );
    expect(option("docker_worktree")).toHaveTextContent(
      I18nKey.COMMON$WORKSPACE_MODE_DOCKER_WORKTREE_HINT,
    );
    for (const mode of ["local_repo", "new_worktree"]) {
      expect(option(mode).querySelectorAll("span.text-xs")).toHaveLength(0);
    }
  });

  it("shows a disabled Docker Worktree row with its reason and ignores clicks", () => {
    const onChange = vi.fn();
    const reason = "Needs a git repository with at least one commit";
    render(
      <WorkspaceModeSelector
        value="local_repo"
        options={[...ALL_MODES]}
        backendKind="local"
        onChange={onChange}
        disabledReasons={{ docker_worktree: reason }}
      />,
    );
    fireEvent.click(screen.getByTestId("workspace-mode-selector"));

    const row = option("docker_worktree");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveTextContent(reason);
    expect(row).not.toHaveTextContent(
      I18nKey.COMMON$WORKSPACE_MODE_DOCKER_WORKTREE_HINT,
    );
    fireEvent.click(row);
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("workspace-mode-selector-menu"),
    ).toBeInTheDocument();
  });
});
