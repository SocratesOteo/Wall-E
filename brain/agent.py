"""
Wall-E Brain — Python ADK Orchestrator
Powered by an open-model API via LiteLLM by default.

Wall-E is your personal coding agent. It can read/write files,
run shell commands, manage git, search the web, and delegate
heavy-lifting tasks to its TypeScript and Go sub-agents.
"""

import os
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

from brain.tools.code_tools import (
    read_file,
    write_file,
    edit_file,
    list_directory,
    search_in_files,
    create_directory,
    delete_file,
)
from brain.tools.shell_tools import run_command, run_tests, install_packages
from brain.tools.git_tools import (
    git_status,
    git_diff,
    git_add,
    git_commit,
    git_log,
    git_branch,
)
from brain.sub_agents.remote_agents import ts_web_agent, go_build_agent
from brain.prompts.system_prompt import WALL_E_SYSTEM_PROMPT

# Model - set WALL_E_MODEL in .env to change the underlying brain.
# Good coding defaults:
#   openrouter/qwen/qwen3-coder
#   deepseek/deepseek-chat
#   groq/moonshotai/kimi-k2-instruct-0905
WALL_E_MODEL_NAME = os.environ.get(
    "WALL_E_MODEL",
    "openrouter/qwen/qwen3-coder",
)
WALL_E_MODEL = LiteLlm(model=WALL_E_MODEL_NAME)


wall_e = LlmAgent(
    name="wall_e",
    model=WALL_E_MODEL,
    description=(
        "Wall-E is an expert coding agent. It builds projects, writes and edits code, "
        "runs tests, manages git, searches for documentation, and orchestrates "
        "TypeScript and Go sub-agents for specialized tasks."
    ),
    instruction=WALL_E_SYSTEM_PROMPT,
    tools=[
        # Code tools
        read_file,
        write_file,
        edit_file,
        list_directory,
        search_in_files,
        create_directory,
        delete_file,
        # Shell tools
        run_command,
        run_tests,
        install_packages,
        # Git tools
        git_status,
        git_diff,
        git_add,
        git_commit,
        git_log,
        git_branch,
    ],
    # Sub-agents available for delegation
    sub_agents=[ts_web_agent, go_build_agent],
)

# Root agent exposed to ADK runner
root_agent = wall_e
