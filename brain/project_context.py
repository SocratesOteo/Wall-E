"""Per-run project context for Wall-E tools."""

from __future__ import annotations

import os
from contextvars import ContextVar
from pathlib import Path

_project_root: ContextVar[Path | None] = ContextVar("wall_e_project_root", default=None)


def default_project_root() -> Path:
    return Path(os.environ.get("WALL_E_PROJECT_ROOT", os.getcwd())).resolve()


def get_project_root() -> Path:
    return (_project_root.get() or default_project_root()).resolve()


def set_project_root(path: str | None):
    root = Path(path).expanduser().resolve() if path else default_project_root()
    return _project_root.set(root)


def reset_project_root(token) -> None:
    _project_root.reset(token)
