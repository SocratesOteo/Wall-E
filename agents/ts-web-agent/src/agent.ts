/**
 * Wall-E TypeScript Sub-Agent — Web & Package Operations
 * Handles npm, web scraping, REST API testing, and frontend generation.
 * Runs as an A2A-compatible HTTP service on port 8001.
 */

import { LlmAgent, InMemorySessionService, Runner, google_search } from "@google/adk";
import type { Content } from "@google/adk";
import { execSync, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ─── Tools ───────────────────────────────────────────────────────────────────

/**
 * Fetch the text content of a URL (docs, READMEs, changelogs).
 */
async function fetchUrl(url: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Wall-E/1.0 (coding agent)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { error: `HTTP ${res.status} ${res.statusText}` };
    }
    const text = await res.text();
    // Strip HTML tags for readable output
    const clean = text.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
    return { content: clean.slice(0, 8000), url };
  } catch (e: unknown) {
    return { error: String(e) };
  }
}

/**
 * Run an npm/yarn/pnpm command.
 */
async function npmCommand(
  command: string,
  cwd: string = process.env.WALL_E_PROJECT_ROOT ?? process.cwd()
): Promise<Record<string, string | number | boolean>> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd, timeout: 60_000 });
    return { stdout: stdout.trim(), stderr: stderr.trim(), success: true };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: err.stdout?.trim() ?? "",
      stderr: err.stderr?.trim() ?? err.message ?? String(e),
      success: false,
    };
  }
}

/**
 * Look up a package on npm — versions, description, dependencies.
 */
async function npmInfo(packageName: string): Promise<Record<string, unknown>> {
  try {
    const { stdout } = await execAsync(`npm info ${packageName} --json`);
    return JSON.parse(stdout);
  } catch (e: unknown) {
    return { error: String(e) };
  }
}

/**
 * Test a REST endpoint and return the response.
 */
async function testApiEndpoint(
  url: string,
  method: string = "GET",
  body?: string,
  headers?: Record<string, string>
): Promise<Record<string, unknown>> {
  try {
    const opts: RequestInit = {
      method: method.toUpperCase(),
      headers: { "Content-Type": "application/json", ...headers },
      signal: AbortSignal.timeout(10_000),
    };
    if (body && method.toUpperCase() !== "GET") opts.body = body;
    const res = await fetch(url, opts);
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }
    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      body: json,
    };
  } catch (e: unknown) {
    return { error: String(e) };
  }
}

// ─── Agent definition ─────────────────────────────────────────────────────────

const tsWebAgent = new LlmAgent({
  name: "ts_web_agent",
  model: "gemini-flash-latest",   // Fast model — delegation tasks are focused
  description:
    "Handles web and Node.js/npm tasks: fetching URLs, npm package management, " +
    "REST API testing, and TypeScript/React code generation.",
  instruction: `
You are Wall-E's TypeScript sub-agent, specializing in web and package ecosystem tasks.

Your responsibilities:
- Fetch and summarize documentation from URLs using fetchUrl
- Run npm/yarn/pnpm commands with npmCommand
- Look up package info with npmInfo
- Test REST APIs with testApiEndpoint
- Generate TypeScript, React, or Node.js code when asked

Be concise. Return structured results the Python orchestrator can act on.
If you can't complete a task, explain clearly why.
  `.trim(),
  tools: [
    fetchUrl,
    npmCommand,
    npmInfo,
    testApiEndpoint,
    google_search,         // Built-in ADK search
  ],
});

// ─── A2A server ───────────────────────────────────────────────────────────────
// Run: npx adk web --agent agent.ts --port 8001

export const rootAgent = tsWebAgent;
