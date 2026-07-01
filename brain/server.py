"""Local HTTP API for the Wall-E brain.

This module intentionally starts with a small mock event stream. The desktop app
can integrate against this stable API before real ADK execution is attached.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

load_dotenv()

DEFAULT_MODEL = os.environ.get("WALL_E_MODEL", "openrouter/qwen/qwen3-coder")
DEFAULT_PROVIDER = os.environ.get("WALL_E_PROVIDER", DEFAULT_MODEL.split("/", 1)[0])
DEFAULT_API_BASE = os.environ.get("WALL_E_API_BASE")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Session:
    id: str
    project_path: str | None
    provider: str
    model: str
    api_base: str | None
    created_at: str
    events: list[dict[str, Any]] = field(default_factory=list)


class CreateSessionRequest(BaseModel):
    project_path: str | None = None
    provider: str | None = None
    model: str | None = None
    api_base: str | None = None


class MessageRequest(BaseModel):
    content: str = Field(min_length=1)
    allow_edits: bool = True
    auto_run_tests: bool = False


class ApprovalRequest(BaseModel):
    approved: bool
    reason: str | None = None


app = FastAPI(title="Wall-E Brain API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1", "http://localhost", "tauri://localhost"],
    allow_origin_regex=r"^(tauri|http)://.*$",
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict[str, Session] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "wall-e-brain",
        "model": DEFAULT_MODEL,
    }


@app.post("/sessions")
def create_session(request: CreateSessionRequest) -> dict[str, Any]:
    session = Session(
        id=str(uuid.uuid4()),
        project_path=request.project_path,
        provider=request.provider or DEFAULT_PROVIDER,
        model=request.model or DEFAULT_MODEL,
        api_base=request.api_base or DEFAULT_API_BASE,
        created_at=utc_now(),
    )
    sessions[session.id] = session
    return asdict(session) | {"events": []}


@app.get("/sessions")
def list_sessions() -> list[dict[str, Any]]:
    return [asdict(session) | {"events": []} for session in sessions.values()]


@app.get("/sessions/{session_id}")
def get_session(session_id: str) -> dict[str, Any]:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return asdict(session) | {"events": []}


@app.post("/sessions/{session_id}/messages")
def add_message(session_id: str, request: MessageRequest) -> dict[str, Any]:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    message_id = str(uuid.uuid4())
    session.events.extend(mock_response_events(session, message_id, request))
    return {
        "session_id": session.id,
        "message_id": message_id,
        "queued": True,
    }


@app.get("/sessions/{session_id}/events")
async def stream_events(session_id: str) -> StreamingResponse:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    async def generate():
        while session.events:
            event = session.events.pop(0)
            yield json.dumps(event) + "\n"
            await asyncio.sleep(0.08)

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/approvals/{approval_id}")
def resolve_approval(approval_id: str, request: ApprovalRequest) -> dict[str, Any]:
    return {
        "approval_id": approval_id,
        "approved": request.approved,
        "reason": request.reason,
    }


def mock_response_events(
    session: Session,
    message_id: str,
    request: MessageRequest,
) -> list[dict[str, Any]]:
    prompt = request.content.strip()
    words = [
        "I",
        "received",
        "that",
        "task.",
        "Next",
        "I",
        "will",
        "inspect",
        "the",
        "project,",
        "plan",
        "the",
        "change,",
        "and",
        "stream",
        "real",
        "tool",
        "events",
        "here.",
    ]

    if "test" in prompt.lower():
        words.extend(["Test", "execution", "will", "appear", "as", "terminal", "events."])

    base = {
        "session_id": session.id,
        "message_id": message_id,
        "timestamp": utc_now(),
    }
    events = [
        base
        | {
            "type": "status",
            "content": f"Queued task for {session.model}",
        }
    ]
    events.extend(base | {"type": "assistant_delta", "content": f"{word} "} for word in words)
    events.append(base | {"type": "assistant_done", "content": ""})
    return events


def main() -> None:
    import uvicorn

    host = os.environ.get("WALL_E_BRAIN_HOST", "127.0.0.1")
    port = int(os.environ.get("WALL_E_BRAIN_PORT", "8765"))
    uvicorn.run("brain.server:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
