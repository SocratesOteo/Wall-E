# Wall-E Native App Iteration Plan

Wall-E is moving from a backend agent plus web mockup into a native personal coding workspace: a private Codex/Claude-style app for building projects, running automations, inspecting changes, and controlling agent work locally.

## Product Direction

Build Wall-E as a native desktop app with:

- A chat-first coding workspace
- Project picker and persistent workspace sessions
- Model/provider controls
- File tree, diffs, terminal output, and tool-call timeline
- Approval gates for risky shell, filesystem, git, network, and automation actions
- Automation dashboard for scheduled and event-driven agent work
- Local-first storage for sessions, preferences, project metadata, and logs

## Recommended Native Stack

Use Tauri as the first native shell.

Reasons:

- Small native app footprint
- Good filesystem/process integration for a coding agent
- Web UI can reuse the existing `interface/` work
- Rust command layer can safely mediate local privileges
- Easier packaging for macOS first, then Windows/Linux

Fallback option: Electron if Tauri blocks speed of development or if Node-native integrations become more important than app size.

## Iteration 1: Native Shell

Goal: turn the current `interface/` into a launchable desktop app.

Steps:

1. Add `apps/desktop/` using Tauri.
2. Move or reuse the current `interface/` assets as the desktop renderer.
3. Add app window chrome, native menu items, and basic settings persistence.
4. Add a project picker that stores the selected project path.
5. Add a native command bridge for:
   - Reading app version
   - Getting selected project path
   - Saving model/provider preferences
   - Opening local folders/files
6. Package a local development command in README.

Acceptance:

- Wall-E launches as a desktop app.
- The UI no longer depends on opening `index.html` manually.
- Model selection and selected project survive app restart.

## Iteration 2: Brain Bridge

Goal: connect the native UI to the Python ADK brain.

Steps:

1. Add a local brain runner process managed by the desktop app.
2. Define a simple local API between app and brain:
   - `POST /sessions`
   - `GET /sessions`
   - `POST /sessions/:id/messages`
   - `GET /sessions/:id/events`
   - `POST /approvals/:id`
3. Stream assistant tokens, tool calls, command output, diffs, and status events.
4. Add graceful start/stop/restart controls for the brain process.
5. Surface provider/model errors clearly in the UI.

Acceptance:

- Sending a message in the native app reaches Wall-E.
- Responses stream into the chat.
- Tool activity appears in an activity timeline.
- Brain process failures can be restarted from the UI.

## Iteration 3: Coding Workspace

Goal: make Wall-E useful for real project work.

Steps:

1. Add a file tree backed by the selected project.
2. Add read-only file preview.
3. Add diff viewer for proposed and applied edits.
4. Add terminal panel for command output.
5. Add git status panel with changed files and branch.
6. Add approve/deny controls for:
   - File writes
   - Package installs
   - Git commits
   - Pushes
   - Destructive commands

Acceptance:

- User can inspect what Wall-E is reading, changing, and running.
- Diffs are visible before risky edits are approved.
- Git state is visible without leaving the app.

## Iteration 4: Automation System

Goal: let Wall-E run recurring and event-based work.

Steps:

1. Add automation model:
   - Name
   - Project
   - Trigger
   - Prompt
   - Schedule
   - Approval policy
   - Last run status
2. Add automation views:
   - List
   - Create/edit
   - Run history
   - Logs
3. Support initial triggers:
   - Manual
   - Daily/weekly schedule
   - Git status change
4. Add notification and approval queue.
5. Persist automation definitions locally.

Acceptance:

- User can create, pause, resume, and delete automations.
- Automation runs are logged.
- Risky automation actions require approval unless explicitly allowed.

## Iteration 5: Memory And Personalization

Goal: make Wall-E feel like a personal agent, not a generic wrapper.

Steps:

1. Add local profile settings:
   - Coding style preferences
   - Favorite package managers
   - Commit style
   - Test preferences
   - Approval defaults
2. Add project memory:
   - Stack summary
   - Common commands
   - Known pitfalls
   - Architecture notes
3. Add searchable session history.
4. Add pinned instructions per project.
5. Add import/export for Wall-E settings.

Acceptance:

- Wall-E remembers how the user wants projects built.
- Project-specific context improves future sessions.
- User can inspect and edit remembered information.

## Iteration 6: Packaging And Release

Goal: make Wall-E installable and dependable.

Steps:

1. Add macOS app packaging. In progress with `npm run package` and `docs/PACKAGING.md`.
2. Add signed/notarized build path when ready.
3. Add update channel planning. Done with Tauri updater pointed at GitHub Releases.
4. Add smoke tests for:
   - App launch
   - Brain startup
   - Message send
   - Tool event stream
   - Project picker
5. Add release checklist.

Acceptance:

- Wall-E can be installed and opened like a normal app.
- A fresh install can configure keys, choose a project, and run a first coding task.

## Immediate Next Build Tasks

1. Scaffold `apps/desktop/` with Tauri. Done.
2. Move the existing `interface/` shell into the Tauri renderer. Done by embedding `interface/` as the desktop frontend.
3. Add local settings persistence for model and project path. Done with native settings commands and `~/.wall-e/settings.json`.
4. Add a native project picker. Done with Tauri's dialog plugin.
5. Define the local brain API contract in `docs/brain-api.md`. Done.
6. Add provider settings for Ollama, OpenRouter, DeepSeek, and Groq. Done.
7. Add safe API key storage through the OS keychain. Done.
8. Add a minimal Python API wrapper around the ADK brain. Started with `brain/server.py`.
9. Stream mock events from the brain wrapper into the desktop app. Done.
10. Let the desktop app start and stop the local Python brain process. Done.
11. Replace mock events with real Wall-E agent events. Done with an ADK runner-backed stream.
12. Move tool calls, terminal output, diffs, and errors into dedicated activity panels.

## Open Decisions

- Tauri vs Electron final choice.
- Whether the brain should stay as a desktop-managed child process long term or move to a local service.
- Whether session storage should start with SQLite or plain JSON files.
- How strict default approvals should be.
- Whether automations can run while the UI is closed.
