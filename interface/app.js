const messages = document.querySelector("#messages");
const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#promptInput");
const modelSelect = document.querySelector("#modelSelect");

const state = {
  model: localStorage.getItem("wall-e-model") || modelSelect.value,
};

modelSelect.value = state.model;

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
  localStorage.setItem("wall-e-model", state.model);
  addMessage("assistant", `Model preference set to ${state.model}.`);
});
