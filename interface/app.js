const messages = document.querySelector("#messages");
const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#promptInput");
const modelSelect = document.querySelector("#modelSelect");
const projectPath = document.querySelector("#projectPath");
const providerName = document.querySelector("#providerName");
const changeProjectButton = document.querySelector("#changeProjectButton");
const settingsButton = document.querySelector("#settingsButton");
const settingsDialog = document.querySelector("#settingsDialog");
const settingsForm = document.querySelector("#settingsForm");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const settingsModel = document.querySelector("#settingsModel");
const settingsApiBase = document.querySelector("#settingsApiBase");
const settingsKeyCallout = document.querySelector("#settingsKeyCallout");
const settingsNote = document.querySelector("#settingsNote");
const resetProviderButton = document.querySelector("#resetProviderButton");
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
  model: localStorage.getItem("wall-e-model") || modelSelect.value,
  provider: localStorage.getItem("wall-e-provider") || providerFromModel(modelSelect.value),
  apiBase: localStorage.getItem("wall-e-api-base") || "",
  projectPath: localStorage.getItem("wall-e-project-path") || projectPath.textContent,
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
  refreshModelOptions();
  projectPath.textContent = state.projectPath;
  providerName.textContent = providerLabel(state.provider);
  settingsModel.value = state.model;
  settingsApiBase.value = state.apiBase || preset.apiBase;
  settingsKeyCallout.textContent = preset.keyName
    ? `Key required later: ${preset.keyName}. Wall-E does not store API keys in plaintext.`
    : "No API key required for this provider.";
  settingsNote.textContent = preset.note;
  providerOptions.forEach((option) => {
    option.classList.toggle("active", option.dataset.provider === state.provider);
  });
}

async function desktopCommand(command, args) {
  if (!invoke) return null;
  return invoke(command, args);
}

async function loadDesktopState() {
  try {
    const settings = await desktopCommand("load_settings");
    if (!settings) return;

    state.model = settings.model || state.model;
    state.provider = settings.provider || providerFromModel(state.model);
    state.apiBase = settings.apiBase || "";
    state.projectPath = settings.projectPath || state.projectPath;
    renderProviderState();
  } catch (error) {
    addMessage("assistant", `Native settings could not be loaded: ${error}`);
  }
}

async function saveDesktopState() {
  localStorage.setItem("wall-e-model", state.model);
  localStorage.setItem("wall-e-provider", state.provider);
  localStorage.setItem("wall-e-api-base", state.apiBase);
  localStorage.setItem("wall-e-project-path", state.projectPath);

  try {
    await desktopCommand("save_settings", {
      settings: {
        model: state.model,
        provider: state.provider,
        apiBase: state.apiBase || null,
        projectPath: state.projectPath,
      },
    });
  } catch (error) {
    addMessage("assistant", `Native settings could not be saved: ${error}`);
  }
}

function useProviderPreset(provider) {
  const preset = providerPresets[provider];
  if (!preset) return;

  state.provider = provider;
  state.model = preset.model;
  state.apiBase = preset.apiBase;
  renderProviderState();
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

function draftAssistantReply(prompt) {
  const lowered = prompt.toLowerCase();

  if (lowered.includes("test") || lowered.includes("bug") || lowered.includes("fix")) {
    return "I will inspect the relevant files, make the smallest solid change, run the matching tests, and show you the result before we commit.";
  }

  if (lowered.includes("automate") || lowered.includes("schedule")) {
    return "I will turn that into a repeatable automation with clear triggers, logs, and an approval point for anything risky.";
  }

  if (lowered.includes("build") || lowered.includes("create")) {
    return "I will map the project shape first, then build the feature in place with the interface, backend, and verification steps kept visible.";
  }

  return "I have captured that request. The next version will stream this to the Wall-E backend and show tool calls, diffs, and terminal output as they happen.";
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  addMessage("user", prompt);
  promptInput.value = "";

  window.setTimeout(() => {
    addMessage("assistant", draftAssistantReply(prompt));
  }, 250);
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
  if (!nextPath) return;

  state.projectPath = String(nextPath).trim();
  projectPath.textContent = state.projectPath;
  saveDesktopState();
  addMessage("assistant", `Project set to ${state.projectPath}.`);
});

settingsButton.addEventListener("click", () => {
  renderProviderState();
  settingsDialog.showModal();
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

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.model = settingsModel.value.trim();
  state.provider = providerFromModel(state.model) || state.provider;
  state.apiBase = settingsApiBase.value.trim();
  renderProviderState();
  saveDesktopState();
  settingsDialog.close();
  addMessage("assistant", `${providerLabel(state.provider)} saved with ${state.model}. ${currentPreset().keyName ? `Set ${currentPreset().keyName} before running hosted requests.` : "Provider settings are ready."}`);
});

renderProviderState();
loadDesktopState();
