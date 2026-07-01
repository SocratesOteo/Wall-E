"""
Shell tools — Wall-E's ability to run commands, tests, and package installs.
Commands run in a subprocess with a configurable timeout.
"""

import os
import subprocess
import shlex
from pathlib import Path

from brain.project_context import get_project_root

DEFAULT_TIMEOUT = int(os.environ.get("WALL_E_COMMAND_TIMEOUT", "60"))

# Commands that require explicit user confirmation before running
DESTRUCTIVE_PATTERNS = ["rm -rf", "DROP TABLE", "DROP DATABASE", "format", "mkfs"]


def _check_destructive(command: str) -> str | None:
    for pattern in DESTRUCTIVE_PATTERNS:
        if pattern.lower() in command.lower():
            return pattern
    return None


def run_command(command: str, cwd: str = ".", timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Execute a shell command in the project directory.

    Args:
        command: The shell command to run (e.g. 'python -m pytest tests/').
        cwd: Working directory relative to project root (default: root).
        timeout: Max seconds to wait before killing the process.

    Returns:
        dict with 'stdout', 'stderr', 'returncode', or 'error'.
    """
    danger = _check_destructive(command)
    if danger:
        return {
            "warning": f"Command contains potentially destructive operation: '{danger}'. "
                       f"Confirm with the user before running.",
            "command": command,
        }

    try:
        work_dir = (get_project_root() / cwd).resolve()
        result = subprocess.run(
            command,
            shell=True,
            cwd=str(work_dir),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
            "success": result.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {"error": f"Command timed out after {timeout}s: {command}"}
    except Exception as e:
        return {"error": str(e)}


def run_tests(
    framework: str = "auto",
    path: str = ".",
    extra_args: str = "",
    cwd: str = ".",
) -> dict:
    """Run the project's test suite.

    Args:
        framework: 'pytest', 'jest', 'go', 'cargo', or 'auto' (detect from cwd).
        path: Test path or pattern to run (e.g. 'tests/test_tools.py').
        extra_args: Additional flags passed to the test runner.
        cwd: Working directory relative to project root.

    Returns:
        dict with test output and pass/fail status.
    """
    work_dir = (get_project_root() / cwd).resolve()

    if framework == "auto":
        if (work_dir / "pyproject.toml").exists() or (work_dir / "setup.py").exists():
            framework = "pytest"
        elif (work_dir / "package.json").exists():
            framework = "jest"
        elif (work_dir / "go.mod").exists():
            framework = "go"
        elif (work_dir / "Cargo.toml").exists():
            framework = "cargo"
        else:
            framework = "pytest"  # fallback

    commands = {
        "pytest": f"python -m pytest {path} -v {extra_args}",
        "jest": f"npx jest {path} {extra_args}",
        "go": f"go test ./... {extra_args}",
        "cargo": f"cargo test {extra_args}",
        "vitest": f"npx vitest run {path} {extra_args}",
    }

    cmd = commands.get(framework, f"python -m pytest {path} {extra_args}")
    return run_command(cmd, cwd=cwd, timeout=120)


def install_packages(packages: str, manager: str = "auto", cwd: str = ".") -> dict:
    """Install packages using the appropriate package manager.

    Args:
        packages: Space-separated package names (e.g. 'requests fastapi uvicorn').
        manager: 'pip', 'npm', 'yarn', 'pnpm', 'go', or 'auto' (detect).
        cwd: Working directory relative to project root.

    Returns:
        dict with install output or error.
    """
    work_dir = (get_project_root() / cwd).resolve()

    if manager == "auto":
        if (work_dir / "go.mod").exists():
            manager = "go"
        elif (work_dir / "yarn.lock").exists():
            manager = "yarn"
        elif (work_dir / "pnpm-lock.yaml").exists():
            manager = "pnpm"
        elif (work_dir / "package.json").exists():
            manager = "npm"
        else:
            manager = "pip"

    commands = {
        "pip": f"pip install {packages}",
        "npm": f"npm install {packages}",
        "yarn": f"yarn add {packages}",
        "pnpm": f"pnpm add {packages}",
        "go": f"go get {packages}",
        "cargo": f"cargo add {packages}",
    }

    cmd = commands.get(manager, f"pip install {packages}")
    return run_command(cmd, cwd=cwd, timeout=120)
