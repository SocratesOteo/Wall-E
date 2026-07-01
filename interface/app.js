const messages = document.querySelector("#messages");
const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#promptInput");
const modelSelect = document.querySelector("#modelSelect");
const projectPath = document.querySelector("#projectPath");
const providerName = document.querySelector("#providerName");
const changeProjectButton = document.querySelector("#changeProjectButton");
const invoke = window.__TAURI__?.core?.invoke;
const openDialog = window.__TAURI__?.dialog?.open;

const state = {
  model: localStorage.getItem("wall-e-model") || modelSelect.value,
  projectPath: localStorage.getItem("wall-e-project-path") || projectPath.textContent,
};

modelSelect.value = state.model;
projectPath.textContent = state.projectPath;
providerName.textContent = providerFromModel(state.model);

function providerFromModel(model) {
  const provider = model.split("/")[0] || "local";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
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
    state.projectPath = settings.projectPath || state.projectPath;
    modelSelect.value = state.model;
    projectPath.textContent = state.projectPath;
    providerName.textContent = providerFromModel(state.model);
  } catch (error) {
    addMessage("assistant", `Native settings could not be loaded: ${error}`);
  }
}

async function saveDesktopState() {
  localStorage.setItem("wall-e-model", state.model);
  localStorage.setItem("wall-e-project-path", state.projectPath);

  try {
    await desktopCommand("save_settings", {
      settings: {
        model: state.model,
        projectPath: state.projectPath,
      },
    });
  } catch (error) {
    addMessage("assistant", `Native settings could not be saved: ${error}`);
  }
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
  providerName.textContent = providerFromModel(state.model);
  saveDesktopState();
  addMessage("assistant", `Model preference set to ${state.model}.`);
});

changeProjectButton.addEventListener("click", async () => {
  const nextPath = await pickProjectFolder();
  if (!nextPath) return;

  state.projectPath = String(nextPath).trim();
  projectPath.textContent = state.projectPath;
  saveDesktopState();
  addMessage("assistant", `Project set to ${state.projectPath}.`);
});

loadDesktopState();
