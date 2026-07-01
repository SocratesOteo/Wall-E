# Wall-E Brain API

The brain API is the local contract between the native desktop app and the Python Wall-E brain.

This starts as a local-only HTTP service. The first implementation streams mock assistant events so the desktop UI can be wired safely before real ADK execution is attached.

## Base URL

Default:

```text
http://127.0.0.1:8765
```

Configurable with:

```bash
WALL_E_BRAIN_HOST=127.0.0.1
WALL_E_BRAIN_PORT=8765
```

## Event Format

Streaming endpoints use newline-delimited JSON.

Each line is one event:

```json
{"type":"assistant_delta","session_id":"...","content":"Hello"}
```

Common event fields:

- `type`: event kind
- `session_id`: session identifier
- `message_id`: message identifier when relevant
- `content`: streamed text when relevant
- `timestamp`: ISO-like UTC timestamp

## Endpoints

### `GET /health`

Returns service status.

Response:

```json
{
  "status": "ok",
  "service": "wall-e-brain",
  "model": "openrouter/qwen/qwen3-coder"
}
```

### `POST /sessions`

Creates a session.

Request:

```json
{
  "project_path": "/Users/socrates/Desktop/projects/wall-e",
  "provider": "openrouter",
  "model": "openrouter/qwen/qwen3-coder",
  "api_base": "https://openrouter.ai/api/v1"
}
```

Response:

```json
{
  "id": "...",
  "project_path": "...",
  "provider": "openrouter",
  "model": "openrouter/qwen/qwen3-coder",
  "created_at": "..."
}
```

### `GET /sessions`

Lists active in-memory sessions.

### `GET /sessions/{session_id}`

Returns one session.

### `POST /sessions/{session_id}/messages`

Adds a user message and queues assistant events.

Request:

```json
{
  "content": "Fix the failing tests",
  "allow_edits": true,
  "auto_run_tests": false
}
```

Response:

```json
{
  "session_id": "...",
  "message_id": "...",
  "queued": true
}
```

### `GET /sessions/{session_id}/events`

Streams and drains queued events for a session as newline-delimited JSON.

Current mock event types:

- `status`
- `assistant_delta`
- `assistant_done`

Future real event types:

- `tool_call_started`
- `tool_call_delta`
- `tool_call_finished`
- `file_read`
- `file_write_pending`
- `file_write_applied`
- `diff`
- `terminal_output`
- `approval_required`
- `approval_resolved`
- `error`

### `POST /approvals/{approval_id}`

Placeholder for approval decisions.

Request:

```json
{
  "approved": true,
  "reason": "Looks safe"
}
```

Response:

```json
{
  "approval_id": "...",
  "approved": true
}
```

## Next Integration Step

After the desktop app can call this API and render events, replace the mock response generator in `brain/server.py` with real ADK runner calls from `brain/agent.py`.
