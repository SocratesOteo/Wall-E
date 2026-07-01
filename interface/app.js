const messages = document.querySelector("#messages");
const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#promptInput");
const modelSelect = document.querySelector("#modelSelect");
const projectPath = document.querySelector("#projectPath");
const providerName = document.querySelector("#providerName");
const changeProjectButton = document.querySelector("#changeProjectButton");
const newWorkspaceButton = document.querySelector("#newWorkspaceButton");
const workspaceTitle = document.querySelector("#workspaceTitle");
const workspaceMode = document.querySelector("#workspaceMode");
const workspaceNavItems = Array.from(document.querySelectorAll(".nav-item"));
const pinnedProjectButton = document.querySelector("#pinnedProjectButton");
const addPinnedProjectButton = document.querySelector("#addPinnedProjectButton");
const editPlanButton = document.querySelector("#editPlanButton");
const taskList = document.querySelector("#taskList");
const newAutomationButton = document.querySelector("#newAutomationButton");
const automationList = document.querySelector("#automationList");
const profileButton = document.querySelector("#profileButton");
const profileAvatar = document.querySelector("#profileAvatar");
const profileName = document.querySelector("#profileName");
const settingsButton = document.querySelector("#settingsButton");
const settingsDialog = document.querySelector("#settingsDialog");
const settingsForm = document.querySelector("#settingsForm");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const settingsProfileName = document.querySelector("#settingsProfileName");
const settingsProfileInitials = document.querySelector("#settingsProfileInitials");
const settingsProjectPath = document.querySelector("#settingsProjectPath");
const settingsModel = document.querySelector("#settingsModel");
const settingsApiBase = document.querySelector("#settingsApiBase");
const settingsBrainBaseUrl = document.querySelector("#settingsBrainBaseUrl");
const settingsApiKeyField = document.querySelector("#settingsApiKeyField");
const settingsApiKey = document.querySelector("#settingsApiKey");
const appInfoCallout = document.querySelector("#appInfoCallout");
const brainStatusCallout = document.querySelector("#brainStatusCallout");
const updateStatusCallout = document.querySelector("#updateStatusCallout");
const settingsKeyCallout = document.querySelector("#settingsKeyCallout");
const settingsNote = document.querySelector("#settingsNote");
const resetProviderButton = document.querySelector("#resetProviderButton");
const startBrainButton = document.querySelector("#startBrainButton");
const stopBrainButton = document.querySelector("#stopBrainButton");
const checkUpdatesButton = document.querySelector("#checkUpdatesButton");
const installUpdateButton = document.querySelector("#installUpdateButton");
const restartAppButton = document.querySelector("#restartAppButton");
const deleteProviderKeyButton = document.querySelector("#deleteProviderKeyButton");
const activityTabs = Array.from(document.querySelectorAll("[data-activity-tab]"));
const activityPanels = Array.from(document.querySelectorAll("[data-activity-panel]"));
const providerOptions = Array.from(document.querySelectorAll(".provider-option"));
const invoke = window.__TAURI__?.core?.invoke;
const openDialog = window.__TAURI__?.dialog?.open;

const providerPresets = {
  ollama: {
    label: "Ollama",
    model: "ollama_chat/qwen2.5-coder:7b",
    apiBase: "http://localhost:11434",
    keyName: null,
    note: "No API key needed. Install Ollama locally and pull the model you choose.",
  },
  openrouter: {
    label: "OpenRouter",
    model: "openrouter/qwen/qwen3-coder",
    apiBase: "https://openrouter.ai/api/v1",
    keyName: "OPENROUTER_API_KEY",
    note: "Requires an OpenRouter API key. Good default when you want one hosted key for many models.",
  },
  deepseek: {
    label: "DeepSeek",
    model: "deepseek/deepseek-chat",
    apiBase: "https://api.deepseek.com",
    keyName: "DEEPSEEK_API_KEY",
    note: "Requires a DeepSeek API key. Strong cheap hosted option for coding.",
  },
  groq: {
    label: "Groq",
    model: "groq/moonshotai/kimi-k2-instruct-0905",
    apiBase: "https://api.groq.com/openai/v1",
    keyName: "GROQ_API_KEY",
    note: "Requires a Groq API key. Best when speed matters and the selected model is available.",
  },
};

const state = {
  appInfo: null,
  profileName: localStorage.getItem("wall-e-profile-name") || "Socrates",
  profileInitials: localStorage.getItem("wall-e-profile-initials") || "S",
  model: localStorage.getItem("wall-e-model") || modelSelect.value,
  provider: localStorage.getItem("wall-e-provider") || providerFromModel(modelSelect.value),
  apiBase: localStorage.getItem("wall-e-api-base") || "",
  brainBaseUrl: localStorage.getItem("wall-e-brain-base-url") || "http://127.0.0.1:8765",
  sessionId: localStorage.getItem("wall-e-session-id") || "",
  brainStatus: null,
  updateStatus: null,
  keyStatus: null,
  projectPath: localStorage.getItem("wall-e-project-path") || projectPath.textContent,
  workspace: localStorage.getItem("wall-e-workspace") || "build",
  activityView: localStorage.getItem("wall-e-activity-view") || "files",
  planEditing: false,
};

const workspacePresets = {
  build: {
    title: "Build Wall-E",
    mode: "Build",
    intro: "Build workspace selected. I am ready to inspect, edit, test, and ship.",
    tasks: [
      ["done", "Create app interface"],
      ["active", "Wire chat to ADK backend"],
      ["", "Stream tool calls and diffs"],
      ["", "Add approvals and automations"],
    ],
  },
  review: {
    title: "Repo Review",
    mode: "Review",
    intro: "Review workspace selected. Ask me to inspect changes, find risks, or summarize the codebase.",
    tasks: [
      ["active", "Check changed files"],
      ["", "Review risky behavior"],
      ["", "Call out missing tests"],
      ["", "Summarize next fixes"],
    ],
  },
  automate: {
    title: "Automation Plans",
    mode: "Automate",
    intro: "Automation workspace selected. We can define recurring repo scans, dependency checks, and approval rules.",
    tasks: [
      ["active", "Choose automation trigger"],
      ["", "Define prompt and project"],
      ["", "Set approval policy"],
      ["", "Review run history"],
    ],
  },
};

function providerFromModel(model) {
  const provider = model.split("/")[0] || "local";
  if (provider === "ollama" || provider === "ollama_chat") {
    return "ollama";
  }
  return provider.toLowerCase();
}

function providerLabel(provider) {
  return providerPresets[provider]?.label || provider.charAt(0).toUpperCase() + provider.slice(1);
}

function currentPreset() {
  return providerPresets[state.provider] || providerPresets.openrouter;
}

function refreshModelOptions() {
  if (![...modelSelect.options].some((option) => option.value === state.model)) {
    modelSelect.add(new Option(state.model, state.model));
  }
  modelSelect.value = state.model;
}

function renderProviderState() {
  const preset = currentPreset();
  const hasKey = Boolean(state.keyStatus?.hasKey);
  refreshModelOptions();
  renderProfileState();
  projectPath.textContent = state.projectPath;
  providerName.textContent = providerLabel(state.provider);
  settingsProjectPath.value = state.projectPath;
  settingsModel.value = state.model;
  settingsApiBase.value = state.apiBase || preset.apiBase;
  settingsBrainBaseUrl.value = state.brainBaseUrl;
  settingsApiKeyField.hidden = !preset.keyName;
  settingsApiKey.value = "";
  settingsApiKey.placeholder = hasKey ? "Key saved in OS keychain" : "Paste key to save in OS keychain";
  deleteProviderKeyButton.hidden = !preset.keyName || !hasKey;
  settingsKeyCallout.textContent = preset.keyName
    ? `${preset.keyName}: ${hasKey ? "saved in OS keychain" : "not saved yet"}. Wall-E never writes this key to settings or localStorage.`
    : "No API key required for this provider.";
  settingsNote.textContent = preset.note;
  providerOptions.forEach((option) => {
    option.classList.toggle("active", option.dataset.provider === state.provider);
  });
}

function renderWorkspaceState(announce = false) {
  const workspace = workspacePresets[state.workspace] || workspacePresets.build;
  workspaceTitle.textContent = workspace.title;
  workspaceMode.textContent = workspace.mode;

  workspaceNavItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.workspace === state.workspace);
  });

  taskList.replaceChildren(
    ...workspace.tasks.map(([className, text]) => {
      const item = document.createElement("li");
      if (className) item.className = className;
      item.textContent = text;
      return item;
    }),
  );

  localStorage.setItem("wall-e-workspace", state.workspace);
  if (announce) {
    addMessage("assistant", workspace.intro);
  }
}

function renderActivityView() {
  activityTabs.forEach((tab) => {
    const active = tab.dataset.activityTab === state.activityView;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  activityPanels.forEach((panel) => {
    panel.hidden = panel.dataset.activityPanel !== state.activityView;
  });

  localStorage.setItem("wall-e-activity-view", state.activityView);
}

function renderProfileState() {
  const initials = (state.profileInitials || state.profileName.slice(0, 1) || "S").trim().slice(0, 2).toUpperCase();
  profileName.textContent = state.profileName || "Socrates";
  profileAvatar.textContent = initials;
  settingsProfileName.value = state.profileName;
  settingsProfileInitials.value = initials;
}

function resetConversation() {
  state.sessionId = "";
  localStorage.removeItem("wall-e-session-id");
  messages.replaceChildren();
  addMessage("assistant", "New workspace started. Pick a project or send me a task.");
  promptInput.focus();
}

async function setProjectPath(nextPath, announce = true) {
  if (!nextPath) return;

  state.projectPath = String(nextPath).trim();
  state.sessionId = "";
  localStorage.removeItem("wall-e-session-id");
  projectPath.textContent = state.projectPath;
  settingsProjectPath.value = state.projectPath;
  await saveDesktopState();
  if (announce) {
    addMessage("assistant", `Project set to ${state.projectPath}.`);
  }
}

function renderAppInfo() {
  if (!state.appInfo) {
    appInfoCallout.textContent = "Wall-E app info will appear here in the native desktop app.";
    return;
  }

  appInfoCallout.textContent = `${state.appInfo.name} ${state.appInfo.version} · Settings stored at ${state.appInfo.settingsPath}`;
}

async function refreshProviderKeyStatus() {
  const preset = currentPreset();
  if (!preset.keyName) {
    state.keyStatus = { provider: state.provider, hasKey: false, keyName: null };
    renderProviderState();
    return;
  }

  try {
    const status = await desktopCommand("get_provider_key_status", { provider: state.provider });
    state.keyStatus = status || { provider: state.provider, hasKey: false, keyName: preset.keyName };
  } catch (error) {
    state.keyStatus = { provider: state.provider, hasKey: false, keyName: preset.keyName };
    addMessage("assistant", `OS keychain status could not be checked: ${error}`);
  }
  renderProviderState();
}

async function desktopCommand(command, args) {
  if (!invoke) return null;
  return invoke(command, args);
}

function renderBrainStatus() {
  const status = state.brainStatus;
  const isNative = Boolean(invoke);

  if (!isNative) {
    brainStatusCallout.textContent = "Native brain controls are available in the desktop app. In browser mode, start the brain with: python3 -m brain.server.";
    startBrainButton.hidden = true;
    stopBrainButton.hidden = true;
    return;
  }

  if (!status) {
    brainStatusCallout.textContent = "Brain process status has not been checked yet.";
    startBrainButton.hidden = false;
    stopBrainButton.hidden = true;
    return;
  }

  brainStatusCallout.textContent = status.running
    ? `Brain running at ${status.url}${status.pid ? ` with PID ${status.pid}` : ""}.`
    : `Brain stopped. It will run at ${state.brainBaseUrl}.`;
  startBrainButton.hidden = status.running;
  stopBrainButton.hidden = !status.running;
}

function renderUpdateStatus() {
  const isNative = Boolean(invoke);
  const status = state.updateStatus;

  if (!isNative) {
    updateStatusCallout.textContent = "Native updates are available in the desktop app.";
    checkUpdatesButton.hidden = true;
    installUpdateButton.hidden = true;
    restartAppButton.hidden = true;
    return;
  }

  if (!status) {
    updateStatusCallout.textContent = "Wall-E can check GitHub Releases for signed updates.";
    checkUpdatesButton.hidden = false;
    installUpdateButton.hidden = true;
    restartAppButton.hidden = true;
    return;
  }

  updateStatusCallout.textContent = status.message || "Update status checked.";
  checkUpdatesButton.hidden = false;
  installUpdateButton.hidden = !status.available;
  restartAppButton.hidden = status.available || !status.version;
}

async function refreshBrainStatus() {
  try {
    const status = await desktopCommand("get_brain_status");
    state.brainStatus = status;
  } catch (error) {
    state.brainStatus = { running: false, pid: null, url: state.brainBaseUrl, message: String(error) };
    addMessage("assistant", `Brain process status could not be checked: ${error}`);
  }
  renderBrainStatus();
}

async function waitForBrainHealth() {
  let lastError = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await brainRequest("/health");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError || new Error("Brain API did not become healthy.");
}

async function ensureBrainRunning() {
  if (!invoke) return;

  const status = await desktopCommand("start_brain", {
    request: { brainBaseUrl: state.brainBaseUrl },
  });
  state.brainStatus = status;
  renderBrainStatus();
  await waitForBrainHealth();
}

async function loadDesktopState() {
  try {
    state.appInfo = await desktopCommand("get_app_info");
    const settings = await desktopCommand("load_settings");
    renderAppInfo();
    if (!settings) return;

    state.model = settings.model || state.model;
    state.provider = settings.provider || providerFromModel(state.model);
    state.apiBase = settings.apiBase || "";
    state.brainBaseUrl = settings.brainBaseUrl || state.brainBaseUrl;
    state.projectPath = settings.projectPath || state.projectPath;
    renderProviderState();
    renderBrainStatus();
    refreshProviderKeyStatus();
  } catch (error) {
    addMessage("assistant", `Native settings could not be loaded: ${error}`);
  }
}

async function saveDesktopState() {
  localStorage.setItem("wall-e-profile-name", state.profileName);
  localStorage.setItem("wall-e-profile-initials", state.profileInitials);
  localStorage.setItem("wall-e-model", state.model);
  localStorage.setItem("wall-e-provider", state.provider);
  localStorage.setItem("wall-e-api-base", state.apiBase);
  localStorage.setItem("wall-e-brain-base-url", state.brainBaseUrl);
  localStorage.setItem("wall-e-project-path", state.projectPath);

  try {
    await desktopCommand("save_settings", {
      settings: {
        model: state.model,
        provider: state.provider,
        apiBase: state.apiBase || null,
        brainBaseUrl: state.brainBaseUrl || null,
        projectPath: state.projectPath,
      },
    });
  } catch (error) {
    addMessage("assistant", `Native settings could not be saved: ${error}`);
  }
}

function openSettings(focusTarget) {
  renderProviderState();
  renderProfileState();
  renderAppInfo();
  refreshProviderKeyStatus();
  refreshBrainStatus();
  renderUpdateStatus();
  settingsDialog.showModal();
  if (focusTarget) {
    requestAnimationFrame(() => focusTarget.focus());
  }
}

function useProviderPreset(provider) {
  const preset = providerPresets[provider];
  if (!preset) return;

  state.provider = provider;
  state.model = preset.model;
  state.apiBase = preset.apiBase;
  state.keyStatus = null;
  renderProviderState();
  refreshProviderKeyStatus();
}

function brainUrl(path) {
  return `${state.brainBaseUrl.replace(/\/$/, "")}${path}`;
}

async function brainRequest(path, options = {}) {
  const response = await fetch(brainUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
    error.status = response.status;
    throw error;
  }

  return response;
}

async function ensureBrainSession() {
  if (state.sessionId) return state.sessionId;

  const response = await brainRequest("/sessions", {
    method: "POST",
    body: JSON.stringify({
      project_path: state.projectPath,
      provider: state.provider,
      model: state.model,
      api_base: state.apiBase || currentPreset().apiBase,
    }),
  });
  const session = await response.json();
  state.sessionId = session.id;
  localStorage.setItem("wall-e-session-id", state.sessionId);
  return state.sessionId;
}

function createAssistantMessage() {
  const article = document.createElement("article");
  article.className = "message assistant";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = "W";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = "Wall-E";

  const paragraph = document.createElement("p");
  paragraph.textContent = "";

  bubble.append(meta, paragraph);
  article.append(avatar, bubble);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;

  return {
    append(text) {
      paragraph.textContent += text;
      messages.scrollTop = messages.scrollHeight;
    },
    set(text) {
      paragraph.textContent = text;
      messages.scrollTop = messages.scrollHeight;
    },
  };
}

async function streamBrainEvents(sessionId, assistantMessage) {
  const response = await brainRequest(`/sessions/${sessionId}/events`, {
    headers: { Accept: "application/x-ndjson" },
  });

  if (!response.body) {
    throw new Error("Brain API did not return a readable event stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      handleBrainEvent(JSON.parse(line), assistantMessage);
    }
  }

  if (buffer.trim()) {
    handleBrainEvent(JSON.parse(buffer), assistantMessage);
  }
}

function handleBrainEvent(event, assistantMessage) {
  if (event.type === "assistant_delta") {
    assistantMessage.append(event.content || "");
    return;
  }

  if (event.type === "status") {
    assistantMessage.set(event.content || "Working...");
    return;
  }

  if (event.type === "tool_call_started") {
    assistantMessage.append(`\n\nRunning ${event.toolName || "tool"}...`);
    return;
  }

  if (event.type === "tool_call_finished") {
    assistantMessage.append(`\nFinished ${event.toolName || "tool"}.`);
    return;
  }

  if (event.type === "error") {
    assistantMessage.set(event.content || "Wall-E hit an error while running the agent.");
    return;
  }
}

async function sendPromptToBrain(prompt) {
  await ensureBrainRunning();
  const sessionId = await ensureBrainSession();
  try {
    await queueBrainMessage(sessionId, prompt);
  } catch (error) {
    if (error.status !== 404) throw error;
    state.sessionId = "";
    localStorage.removeItem("wall-e-session-id");
    await queueBrainMessage(await ensureBrainSession(), prompt);
  }

  const assistantMessage = createAssistantMessage();
  await streamBrainEvents(state.sessionId, assistantMessage);
}

async function queueBrainMessage(sessionId, prompt) {
  await brainRequest(`/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: prompt,
      allow_edits: true,
      auto_run_tests: false,
    }),
  });
}

async function pickProjectFolder() {
  if (openDialog) {
    return openDialog({
      directory: true,
      multiple: false,
      title: "Choose Wall-E project folder",
      defaultPath: state.projectPath,
    });
  }

  return window.prompt("Project folder path", state.projectPath);
}

function addMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "S" : "W";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = role === "user" ? "You" : "Wall-E";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  bubble.append(meta, paragraph);
  article.append(avatar, bubble);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
}

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  addMessage("user", prompt);
  promptInput.value = "";

  try {
    await sendPromptToBrain(prompt);
  } catch (error) {
    addMessage("assistant", `I could not reach the brain API at ${state.brainBaseUrl}. ${invoke ? "Try Start Brain in Settings." : "Start it with: python3 -m brain.server."} Details: ${error.message}`);
  }
});

modelSelect.addEventListener("change", () => {
  state.model = modelSelect.value;
  state.provider = providerFromModel(state.model);
  if (!state.apiBase && providerPresets[state.provider]) {
    state.apiBase = providerPresets[state.provider].apiBase;
  }
  renderProviderState();
  saveDesktopState();
  addMessage("assistant", `Model preference set to ${state.model}. ${currentPreset().keyName ? `Use ${currentPreset().keyName} for hosted requests.` : "No API key is needed for this provider."}`);
});

changeProjectButton.addEventListener("click", async () => {
  const nextPath = await pickProjectFolder();
  await setProjectPath(nextPath);
});

newWorkspaceButton.addEventListener("click", () => {
  state.workspace = "build";
  renderWorkspaceState();
  resetConversation();
});

workspaceNavItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    state.workspace = item.dataset.workspace || "build";
    renderWorkspaceState(true);
  });
});

pinnedProjectButton.addEventListener("click", async () => {
  await setProjectPath(pinnedProjectButton.dataset.projectPath);
});

addPinnedProjectButton.addEventListener("click", async () => {
  const nextPath = await pickProjectFolder();
  if (!nextPath) return;
  pinnedProjectButton.dataset.projectPath = String(nextPath).trim();
  pinnedProjectButton.textContent = String(nextPath).replace(/^\/Users\/[^/]+/, "");
  await setProjectPath(nextPath);
});

editPlanButton.addEventListener("click", () => {
  state.planEditing = !state.planEditing;
  taskList.contentEditable = String(state.planEditing);
  editPlanButton.textContent = state.planEditing ? "Done" : "Edit";
  taskList.classList.toggle("editing", state.planEditing);
  if (state.planEditing) taskList.focus();
});

newAutomationButton.addEventListener("click", () => {
  state.workspace = "automate";
  renderWorkspaceState();
  addMessage("assistant", "Automation draft started. Tell me the trigger, project, prompt, and approval policy you want.");
});

automationList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-automation]");
  if (!button) return;

  state.workspace = "automate";
  renderWorkspaceState();
  const label = button.querySelector("span")?.textContent || "Automation";
  addMessage("assistant", `${label} selected. I can help edit its schedule, prompt, approvals, or run history next.`);
});

activityTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.activityView = tab.dataset.activityTab || "files";
    renderActivityView();
  });
});

profileButton.addEventListener("click", () => {
  openSettings(settingsProfileName);
});

settingsButton.addEventListener("click", () => {
  openSettings();
});

closeSettingsButton.addEventListener("click", () => {
  settingsDialog.close();
});

providerOptions.forEach((option) => {
  option.addEventListener("click", () => {
    useProviderPreset(option.dataset.provider);
  });
});

resetProviderButton.addEventListener("click", () => {
  useProviderPreset(state.provider);
});

startBrainButton.addEventListener("click", async () => {
  try {
    state.brainBaseUrl = settingsBrainBaseUrl.value.trim() || "http://127.0.0.1:8765";
    const status = await desktopCommand("start_brain", {
      request: { brainBaseUrl: state.brainBaseUrl },
    });
    state.brainStatus = status;
    renderBrainStatus();
    await waitForBrainHealth();
    addMessage("assistant", `Brain started at ${state.brainBaseUrl}.`);
  } catch (error) {
    addMessage("assistant", `Brain could not be started: ${error}`);
  }
});

stopBrainButton.addEventListener("click", async () => {
  try {
    const status = await desktopCommand("stop_brain");
    state.brainStatus = status;
    state.sessionId = "";
    localStorage.removeItem("wall-e-session-id");
    renderBrainStatus();
    addMessage("assistant", "Brain stopped.");
  } catch (error) {
    addMessage("assistant", `Brain could not be stopped: ${error}`);
  }
});

checkUpdatesButton.addEventListener("click", async () => {
  try {
    updateStatusCallout.textContent = "Checking GitHub Releases for updates...";
    const status = await desktopCommand("check_for_update");
    state.updateStatus = status;
    renderUpdateStatus();
    addMessage("assistant", status.message || "Update check finished.");
  } catch (error) {
    state.updateStatus = null;
    renderUpdateStatus();
    addMessage("assistant", `Update check failed: ${error}`);
  }
});

installUpdateButton.addEventListener("click", async () => {
  try {
    updateStatusCallout.textContent = "Downloading and installing the signed update...";
    const status = await desktopCommand("install_pending_update");
    state.updateStatus = status;
    renderUpdateStatus();
    addMessage("assistant", status.message || "Update installed. Restart Wall-E to finish.");
  } catch (error) {
    addMessage("assistant", `Update install failed: ${error}`);
  }
});

restartAppButton.addEventListener("click", async () => {
  try {
    await desktopCommand("restart_app");
  } catch (error) {
    addMessage("assistant", `Wall-E could not restart automatically: ${error}`);
  }
});

deleteProviderKeyButton.addEventListener("click", async () => {
  try {
    const status = await desktopCommand("delete_provider_key", {
      request: { provider: state.provider },
    });
    state.keyStatus = status || { provider: state.provider, hasKey: false, keyName: currentPreset().keyName };
    renderProviderState();
    addMessage("assistant", `${providerLabel(state.provider)} API key removed from the OS keychain.`);
  } catch (error) {
    addMessage("assistant", `API key could not be removed from the OS keychain: ${error}`);
  }
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previousBrainBaseUrl = state.brainBaseUrl;
  state.profileName = settingsProfileName.value.trim() || "Socrates";
  state.profileInitials = (settingsProfileInitials.value.trim() || state.profileName.slice(0, 1) || "S")
    .slice(0, 2)
    .toUpperCase();
  state.model = settingsModel.value.trim();
  state.provider = providerFromModel(state.model) || state.provider;
  state.apiBase = settingsApiBase.value.trim();
  state.brainBaseUrl = settingsBrainBaseUrl.value.trim() || "http://127.0.0.1:8765";
  if (state.brainBaseUrl !== previousBrainBaseUrl) {
    state.sessionId = "";
    localStorage.removeItem("wall-e-session-id");
  }
  const apiKey = settingsApiKey.value.trim();
  renderProviderState();
  await saveDesktopState();

  if (currentPreset().keyName && apiKey) {
    if (!invoke) {
      addMessage("assistant", "API keys can only be saved from the native app because browser mode has no OS keychain access.");
      return;
    }

    try {
      const status = await desktopCommand("save_provider_key", {
        request: {
          provider: state.provider,
          apiKey,
        },
      });
      state.keyStatus = status;
      settingsApiKey.value = "";
      renderProviderState();
    } catch (error) {
      addMessage("assistant", `API key could not be saved to the OS keychain: ${error}`);
      return;
    }
  }

  settingsDialog.close();
  addMessage("assistant", `${providerLabel(state.provider)} saved with ${state.model}. ${currentPreset().keyName && !state.keyStatus?.hasKey ? `Save ${currentPreset().keyName} before running hosted requests.` : "Provider settings are ready."}`);
});

renderProviderState();
renderProfileState();
renderAppInfo();
renderWorkspaceState();
renderActivityView();
renderBrainStatus();
renderUpdateStatus();
loadDesktopState();
