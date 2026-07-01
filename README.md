# Wall-E — Your Personal Coding Agent

Wall-E is a multi-agent coding assistant built on Google ADK.

**Brain**: Python orchestrator powered by a configurable LiteLLM model  
**Sub-agents**: TypeScript (web & npm) · Go (builds & file ops)  
**Protocol**: A2A (Agent-to-Agent) for cross-language delegation

---

## Quick start

### 1. Install prerequisites

```bash
# Native desktop app
cd apps/desktop && npm install

# Python brain
pip install -r requirements.txt

# TypeScript sub-agent
cd agents/ts-web-agent && npm install

# Go sub-agent (requires Go 1.22+)
cd agents/go-build-agent && go mod tidy
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY and GOOGLE_API_KEY
```

### 3. Run Wall-E

**Option A - native desktop app**
```bash
cd apps/desktop
npm run dev
```

**Package the native app**
```bash
cd apps/desktop
npm run package
```

**Option B - all in Docker (recommended)**
```bash
PROJECT_PATH=/path/to/your/project docker compose up
# Open http://localhost:8000 for the ADK web UI
```

**Option C - run manually (3 terminals)**
```bash
# Terminal 1: Go sub-agent
cd agents/go-build-agent && go run main.go

# Terminal 2: TypeScript sub-agent
cd agents/ts-web-agent && npm start

# Terminal 3: Wall-E brain API
python -m brain.server

# Or Wall-E brain via ADK web UI
cd brain && WALL_E_PROJECT_ROOT=/your/project adk web --port 8000

# Or chat via CLI
cd brain && WALL_E_PROJECT_ROOT=/your/project adk run
```

---

## Project structure

```
wall-e/
├── brain/
│   ├── agent.py                # Root orchestrator — configurable LiteLLM model
│   ├── tools/
│   │   ├── code_tools.py       # read_file, write_file, edit_file, search
│   │   ├── shell_tools.py      # run_command, run_tests, install_packages
│   │   └── git_tools.py        # git_status, git_diff, git_commit, etc.
│   ├── sub_agents/
│   │   └── remote_agents.py    # A2A connections to TS and Go agents
│   └── prompts/
│       └── system_prompt.py    # Wall-E's personality and workflow rules
│
├── agents/
│   ├── ts-web-agent/
│   │   └── src/agent.ts        # npm, URL fetch, REST testing, frontend code
│   └── go-build-agent/
│       └── main.go             # parallel builds, file search, disk ops
│
├── interface/
│   ├── index.html              # Wall-E workspace UI
│   ├── styles.css
│   └── app.js
│
├── apps/
│   └── desktop/                # Tauri native desktop shell
│       ├── package.json
│       └── src-tauri/
│
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## What Wall-E can do

| Ask Wall-E to... | What happens |
|---|---|
| "Read my main.py and fix the bug" | Reads file → edits in place → runs tests |
| "Add a login endpoint to routes.py" | Reads existing routes → appends → runs tests |
| "What packages does this project use?" | Reads package.json / requirements.txt |
| "Install fastapi and add a health check" | Installs package → creates endpoint → commits |
| "Find all uses of `TODO` in my code" | Searches across all files |
| "Commit everything with a good message" | git add . → writes commit message → commits |
| "Fetch the FastAPI docs for lifespan" | Delegates to TS sub-agent → returns summary |
| "Find all .py files over 300 lines" | Delegates to Go sub-agent → returns list |

---

## Swapping models

Wall-E defaults to `openrouter/qwen/qwen3-coder`, a strong open-model coding route that is usually much cheaper than Claude Opus. To use a different model, set `WALL_E_MODEL` in `.env`:

```bash
# Default: OpenRouter + Qwen3 Coder
WALL_E_MODEL=openrouter/qwen/qwen3-coder
OPENROUTER_API_KEY=sk-or-...

# Other good coding options
WALL_E_MODEL=deepseek/deepseek-chat
WALL_E_MODEL=groq/moonshotai/kimi-k2-instruct-0905

# You can still use Anthropic if you want to compare quality later
WALL_E_MODEL=anthropic/claude-opus-4-8
ANTHROPIC_API_KEY=sk-ant-...
```

The sub-agents use Gemini Flash by default (fast and cheap for delegation tasks).
You can change them in their respective agent files.

---

## Interface

Wall-E includes a first-pass local workspace UI in `interface/`.

The preferred path is now the native desktop app:

```bash
cd apps/desktop
npm install
npm run dev
```

The Tauri app embeds the existing `interface/` renderer and adds native commands for app info, local settings persistence, and a native folder picker.
The settings panel includes provider presets for Ollama, OpenRouter, DeepSeek, and Groq. Ollama runs locally without an API key; hosted provider keys are stored through the OS keychain.
The desktop app can also start and stop the local Python brain process for you, so the composer can connect without a separate brain terminal.

Packaging notes live in `docs/PACKAGING.md`.

You can still open `interface/index.html` in a browser to try the shell without native features. It currently provides:

- Chat workspace with a composer and model selector
- Project, branch, provider, and plan panels
- File, diff, terminal, and automation placeholders
- Real ADK brain streaming when the local brain API is running

The next step is to move tool calls, file diffs, terminal output, approvals, and automation events into dedicated activity panels instead of rendering the first-pass stream in chat.

The local brain API contract lives in `docs/brain-api.md`. Start the first mock streaming API with:

```bash
python -m brain.server
```

Once the server is running, the desktop composer sends messages to the local ADK brain and renders streamed events. In the native app, Wall-E starts the local brain automatically before sending a message. The default brain URL is `http://127.0.0.1:8765` and can be changed in Settings.

---

## Extending Wall-E

**Add a new tool** (Python): Add a function to `brain/tools/` and import it in `brain/agent.py`.

**Add a new sub-agent**: Implement an A2A server (TS, Go, or Python), register its URL in `.env`, and add a `RemoteA2aAgent` in `brain/sub_agents/remote_agents.py`.

**Give Wall-E persistent memory**: Replace `InMemorySessionService` in the runner with `VertexAiSessionService` for sessions that survive restarts.
