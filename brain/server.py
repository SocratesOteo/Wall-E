"""Local HTTP API for the Wall-E brain."""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel, Field

from brain.agent import create_wall_e_agent
from brain.project_context import reset_project_root, set_project_root

load_dotenv()

APP_NAME = "wall-e"
USER_ID = "desktop"
DEFAULT_MODEL = os.environ.get("WALL_E_MODEL", "openrouter/qwen/qwen3-coder")
DEFAULT_PROVIDER = os.environ.get("WALL_E_PROVIDER", DEFAULT_MODEL.split("/", 1)[0])
DEFAULT_API_BASE = os.environ.get("WALL_E_API_BASE")
STREAM_DONE = "__wall_e_stream_done__"


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
    active_message_id: str | None = None


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
runners: dict[str, Runner] = {}
event_queues: dict[str, asyncio.Queue[dict[str, Any]]] = {}
active_tasks: dict[str, asyncio.Task[None]] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "wall-e-brain",
        "model": DEFAULT_MODEL,
    }


def public_session(session: Session) -> dict[str, Any]:
    return {
        "id": session.id,
        "project_path": session.project_path,
        "provider": session.provider,
        "model": session.model,
        "api_base": session.api_base,
        "created_at": session.created_at,
        "events": [],
    }


@app.post("/sessions")
async def create_session(request: CreateSessionRequest) -> dict[str, Any]:
    session = Session(
        id=str(uuid.uuid4()),
        project_path=request.project_path,
        provider=request.provider or DEFAULT_PROVIDER,
        model=request.model or DEFAULT_MODEL,
        api_base=request.api_base or DEFAULT_API_BASE,
        created_at=utc_now(),
    )
    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID,
        session_id=session.id,
        state={
            "project_path": session.project_path,
            "provider": session.provider,
            "model": session.model,
            "api_base": session.api_base,
        },
    )
    runners[session.id] = Runner(
        app_name=APP_NAME,
        agent=create_wall_e_agent(session.model),
        session_service=session_service,
    )
    event_queues[session.id] = asyncio.Queue()
    sessions[session.id] = session
    return public_session(session)


@app.get("/sessions")
def list_sessions() -> list[dict[str, Any]]:
    return [public_session(session) for session in sessions.values()]


@app.get("/sessions/{session_id}")
def get_session(session_id: str) -> dict[str, Any]:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return public_session(session)


@app.post("/sessions/{session_id}/messages")
async def add_message(session_id: str, request: MessageRequest) -> dict[str, Any]:
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_id not in runners:
        raise HTTPException(status_code=500, detail="Session runner not found")

    active_task = active_tasks.get(session_id)
    if active_task and not active_task.done():
        raise HTTPException(status_code=409, detail="Wall-E is already working on this session")

    message_id = str(uuid.uuid4())
    session.active_message_id = message_id
    active_tasks[session_id] = asyncio.create_task(run_agent_message(session, message_id, request))
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
    queue = event_queues.get(session_id)
    if not queue:
        raise HTTPException(status_code=500, detail="Session event queue not found")

    async def generate():
        while True:
            event = await queue.get()
            if event.get("type") == STREAM_DONE:
                break
            yield json.dumps(event) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/approvals/{approval_id}")
def resolve_approval(approval_id: str, request: ApprovalRequest) -> dict[str, Any]:
    return {
        "approval_id": approval_id,
        "approved": request.approved,
        "reason": request.reason,
    }


async def run_agent_message(
    session: Session,
    message_id: str,
    request: MessageRequest,
) -> None:
    queue = event_queues[session.id]
    runner = runners[session.id]
    project_token = set_project_root(session.project_path)
    emitted_error = False

    try:
        await emit_event(
            session,
            message_id,
            "status",
            content=f"Running {session.model}",
        )
        message = types.Content(
            role="user",
            parts=[types.Part.from_text(text=request.content.strip())],
        )

        async for adk_event in runner.run_async(
            user_id=USER_ID,
            session_id=session.id,
            new_message=message,
        ):
            for event in events_from_adk_event(session, message_id, adk_event):
                emitted_error = emitted_error or event.get("type") == "error"
                await queue.put(event)

        await emit_event(session, message_id, "assistant_done", content="")
    except Exception as error:
        if not emitted_error:
            await emit_event(
                session,
                message_id,
                "error",
                content=str(error),
            )
    finally:
        reset_project_root(project_token)
        session.active_message_id = None
        await queue.put(
            {
                "type": STREAM_DONE,
                "session_id": session.id,
                "message_id": message_id,
                "timestamp": utc_now(),
            }
        )


async def emit_event(
    session: Session,
    message_id: str,
    event_type: str,
    content: str = "",
    **extra: Any,
) -> None:
    event = {
        "type": event_type,
        "session_id": session.id,
        "message_id": message_id,
        "timestamp": utc_now(),
        "content": content,
    } | extra
    await event_queues[session.id].put(event)


def events_from_adk_event(
    session: Session,
    message_id: str,
    adk_event: Any,
) -> list[dict[str, Any]]:
    base = {
        "session_id": session.id,
        "message_id": message_id,
        "timestamp": utc_now(),
    }
    events: list[dict[str, Any]] = []

    for call in adk_event.get_function_calls() or []:
        events.append(
            base
            | {
                "type": "tool_call_started",
                "tool_call_id": getattr(call, "id", None),
                "tool_name": getattr(call, "name", "tool"),
                "args": json_safe(getattr(call, "args", {})),
                "content": getattr(call, "name", "tool"),
            }
        )

    for response in adk_event.get_function_responses() or []:
        events.append(
            base
            | {
                "type": "tool_call_finished",
                "tool_call_id": getattr(response, "id", None),
                "tool_name": getattr(response, "name", "tool"),
                "result": json_safe(getattr(response, "response", {})),
                "content": getattr(response, "name", "tool"),
            }
        )

    text = text_from_adk_event(adk_event)
    if text:
        events.append(base | {"type": "assistant_delta", "content": text})

    if getattr(adk_event, "error_message", None):
        events.append(base | {"type": "error", "content": adk_event.error_message})

    return events


def text_from_adk_event(adk_event: Any) -> str:
    content = getattr(adk_event, "content", None)
    parts = getattr(content, "parts", None) or []
    chunks: list[str] = []

    for part in parts:
        text = getattr(part, "text", None)
        if text:
            chunks.append(text)

    return "".join(chunks)


def json_safe(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


def main() -> None:
    import uvicorn

    host = os.environ.get("WALL_E_BRAIN_HOST", "127.0.0.1")
    port = int(os.environ.get("WALL_E_BRAIN_PORT", "8765"))
    uvicorn.run("brain.server:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
