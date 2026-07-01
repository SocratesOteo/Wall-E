"""
Remote sub-agents — Wall-E's A2A connections to TypeScript and Go agents.
Each agent runs as an independent HTTP service. Wall-E calls them when
it needs to delegate specialized work.
"""

import os

try:
    from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
except ModuleNotFoundError:
    RemoteA2aAgent = None

TS_AGENT_URL = os.environ.get("WALL_E_TS_AGENT_URL", "http://localhost:8001")
GO_AGENT_URL = os.environ.get("WALL_E_GO_AGENT_URL", "http://localhost:8002")

# TypeScript Web Agent
# Handles: npm packages, web scraping, API testing, frontend code
ts_web_agent = (
    RemoteA2aAgent(
        name="ts_web_agent",
        description=(
            "Handles web and frontend tasks: "
            "fetching documentation from URLs, npm/yarn package management, "
            "REST API testing, and TypeScript/React code generation. "
            "Delegate here when the task involves the browser, the web, or Node.js packages."
        ),
        agent_card_url=f"{TS_AGENT_URL}/.well-known/agent.json",
    )
    if RemoteA2aAgent
    else None
)

# Go Build Agent
# Handles: fast file ops, concurrent builds, system monitoring
go_build_agent = (
    RemoteA2aAgent(
        name="go_build_agent",
        description=(
            "Handles performance-critical and concurrent tasks: "
            "bulk file system operations, parallel build steps, "
            "binary execution monitoring, and anything that benefits "
            "from Go's concurrency model. "
            "Delegate here for large-scale file processing or complex build pipelines."
        ),
        agent_card_url=f"{GO_AGENT_URL}/.well-known/agent.json",
    )
    if RemoteA2aAgent
    else None
)

remote_sub_agents = [agent for agent in (ts_web_agent, go_build_agent) if agent is not None]
