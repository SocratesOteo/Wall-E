"""
Code tools — Wall-E's file system capabilities.
All paths are resolved relative to the configured PROJECT_ROOT.
"""

import os
import re
import shutil
from pathlib import Path
from typing import Optional

from brain.project_context import get_project_root


def _resolve(path: str) -> Path:
    """Resolve a path relative to PROJECT_ROOT. Prevents directory traversal."""
    project_root = get_project_root()
    resolved = (project_root / path).resolve()
    try:
        resolved.relative_to(project_root)
    except ValueError:
        raise ValueError(f"Path '{path}' escapes the project root. Blocked.")
    return resolved


def read_file(path: str) -> dict:
    """Read the full contents of a file.

    Args:
        path: Path to the file, relative to the project root.

    Returns:
        dict with 'content' (string) or 'error' (string).
    """
    try:
        target = _resolve(path)
        if not target.exists():
            return {"error": f"File not found: {path}"}
        if not target.is_file():
            return {"error": f"'{path}' is a directory, not a file."}
        content = target.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()
        return {
            "content": content,
            "lines": len(lines),
            "size_bytes": target.stat().st_size,
        }
    except Exception as e:
        return {"error": str(e)}


def write_file(path: str, content: str) -> dict:
    """Write content to a file, creating it (and parent directories) if needed.

    Args:
        path: Destination path relative to the project root.
        content: Full text content to write.

    Returns:
        dict with 'status' or 'error'.
    """
    try:
        target = _resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"status": "ok", "path": str(path), "bytes_written": len(content.encode())}
    except Exception as e:
        return {"error": str(e)}


def edit_file(path: str, old_text: str, new_text: str) -> dict:
    """Replace a specific block of text in a file (surgical edit).

    old_text must appear exactly once. Use write_file for full rewrites.

    Args:
        path: Path to the file relative to the project root.
        old_text: Exact text to find (must be unique in the file).
        new_text: Text to replace it with.

    Returns:
        dict with 'status' or 'error'.
    """
    try:
        target = _resolve(path)
        if not target.exists():
            return {"error": f"File not found: {path}"}
        content = target.read_text(encoding="utf-8")
        count = content.count(old_text)
        if count == 0:
            return {"error": "old_text not found in file. Check for whitespace differences."}
        if count > 1:
            return {"error": f"old_text appears {count} times. Make it more specific."}
        new_content = content.replace(old_text, new_text, 1)
        target.write_text(new_content, encoding="utf-8")
        return {"status": "ok", "path": str(path)}
    except Exception as e:
        return {"error": str(e)}


def list_directory(path: str = ".", max_depth: int = 3) -> dict:
    """List files and directories up to max_depth levels deep.

    Args:
        path: Directory path relative to project root (default: root).
        max_depth: How many levels to recurse (default: 3).

    Returns:
        dict with 'tree' (list of relative path strings) or 'error'.
    """
    try:
        target = _resolve(path)
        if not target.exists():
            return {"error": f"Directory not found: {path}"}
        if not target.is_dir():
            return {"error": f"'{path}' is a file, not a directory."}

        entries = []
        for item in sorted(target.rglob("*")):
            # Skip hidden files and common noise
            rel = item.relative_to(target)
            parts = rel.parts
            if any(p.startswith(".") or p in ("node_modules", "__pycache__", ".git", "dist", "build", ".venv") for p in parts):
                continue
            if len(parts) <= max_depth:
                prefix = "  " * (len(parts) - 1)
                marker = "/" if item.is_dir() else ""
                entries.append(f"{prefix}{item.name}{marker}")

        return {"tree": entries, "count": len(entries)}
    except Exception as e:
        return {"error": str(e)}


def search_in_files(pattern: str, path: str = ".", file_glob: str = "*") -> dict:
    """Search for a regex pattern across files in the project.

    Args:
        pattern: Regex pattern to search for.
        path: Directory to search in, relative to project root.
        file_glob: Glob pattern to filter files (e.g. '*.py', '*.ts').

    Returns:
        dict with 'matches' list (each has 'file', 'line', 'text') or 'error'.
    """
    try:
        target = _resolve(path)
        regex = re.compile(pattern, re.IGNORECASE)
        matches = []
        for file in sorted(target.rglob(file_glob)):
            if not file.is_file():
                continue
            parts = file.relative_to(target).parts
            if any(p.startswith(".") or p in ("node_modules", "__pycache__", ".git") for p in parts):
                continue
            try:
                for i, line in enumerate(file.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                    if regex.search(line):
                        matches.append({
                            "file": str(file.relative_to(get_project_root())),
                            "line": i,
                            "text": line.strip(),
                        })
            except Exception:
                continue
        return {"matches": matches, "count": len(matches)}
    except Exception as e:
        return {"error": str(e)}


def create_directory(path: str) -> dict:
    """Create a directory (and any missing parents).

    Args:
        path: Directory path relative to project root.

    Returns:
        dict with 'status' or 'error'.
    """
    try:
        target = _resolve(path)
        target.mkdir(parents=True, exist_ok=True)
        return {"status": "ok", "path": str(path)}
    except Exception as e:
        return {"error": str(e)}


def delete_file(path: str) -> dict:
    """Delete a file (not a directory). Use with caution.

    Args:
        path: Path to the file relative to project root.

    Returns:
        dict with 'status' or 'error'.
    """
    try:
        target = _resolve(path)
        if not target.exists():
            return {"error": f"File not found: {path}"}
        if target.is_dir():
            return {"error": "Use shell_tools.run_command('rm -rf ...') to remove directories."}
        target.unlink()
        return {"status": "ok", "deleted": str(path)}
    except Exception as e:
        return {"error": str(e)}
