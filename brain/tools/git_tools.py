"""
Git tools — Wall-E's git operations.
All commands run in the PROJECT_ROOT git repo.
"""

import os
from pathlib import Path
from brain.tools.shell_tools import run_command

PROJECT_ROOT = Path(os.environ.get("WALL_E_PROJECT_ROOT", os.getcwd()))


def git_status() -> dict:
    """Get the current git status of the repository.

    Returns:
        dict with 'output' (status text) or 'error'.
    """
    return run_command("git status --short --branch")


def git_diff(path: str = None, staged: bool = False) -> dict:
    """Show git diff for the working tree or a specific file.

    Args:
        path: Optional file path to diff (shows all changes if None).
        staged: If True, show staged (cached) changes instead.

    Returns:
        dict with 'stdout' (diff text) or 'error'.
    """
    staged_flag = "--cached" if staged else ""
    target = path or ""
    return run_command(f"git diff {staged_flag} {target}".strip())


def git_add(paths: str = ".") -> dict:
    """Stage files for commit.

    Args:
        paths: Space-separated file paths to stage, or '.' for all changes.

    Returns:
        dict with 'status' or 'error'.
    """
    return run_command(f"git add {paths}")


def git_commit(message: str) -> dict:
    """Create a git commit with the staged changes.

    Args:
        message: Commit message. Be descriptive — Wall-E writes good commit messages.

    Returns:
        dict with commit output or 'error'.
    """
    # Escape the message for shell safety
    safe_msg = message.replace('"', '\\"')
    return run_command(f'git commit -m "{safe_msg}"')


def git_log(n: int = 10, oneline: bool = True) -> dict:
    """Show the recent commit history.

    Args:
        n: Number of commits to show (default: 10).
        oneline: If True, compact one-line format (default: True).

    Returns:
        dict with 'stdout' (log text) or 'error'.
    """
    fmt = "--oneline" if oneline else "--format='%h %an %ar %s'"
    return run_command(f"git log -{n} {fmt}")


def git_branch(name: str = None, checkout: bool = False) -> dict:
    """List branches or create/switch to a branch.

    Args:
        name: Branch name to create or switch to. If None, lists all branches.
        checkout: If True, switch to the branch (creates it if it doesn't exist).

    Returns:
        dict with branch output or 'error'.
    """
    if name is None:
        return run_command("git branch -a")
    if checkout:
        # Try switching first; if not found, create and switch
        result = run_command(f"git checkout {name}")
        if result.get("returncode") != 0:
            result = run_command(f"git checkout -b {name}")
        return result
    return run_command(f"git branch {name}")
