use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const DEFAULT_MODEL: &str = "openrouter/qwen/qwen3-coder";
const DEFAULT_PROVIDER: &str = "openrouter";
const DEFAULT_BRAIN_BASE_URL: &str = "http://127.0.0.1:8765";
const KEYCHAIN_SERVICE: &str = "Wall-E";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: String,
    version: String,
    settings_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    model: String,
    provider: String,
    api_base: Option<String>,
    brain_base_url: Option<String>,
    project_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct KeyStatus {
    provider: String,
    has_key: bool,
    key_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BrainStatus {
    running: bool,
    pid: Option<u32>,
    url: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateStatus {
    available: bool,
    current_version: String,
    version: Option<String>,
    notes: Option<String>,
    date: Option<String>,
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveProviderKeyRequest {
    provider: String,
    api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderKeyRequest {
    provider: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartBrainRequest {
    brain_base_url: Option<String>,
}

struct BrainProcessState {
    child: Mutex<Option<Child>>,
    url: Mutex<String>,
}

#[derive(Default)]
struct PendingUpdateState {
    update: Mutex<Option<Update>>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            model: DEFAULT_MODEL.to_string(),
            provider: DEFAULT_PROVIDER.to_string(),
            api_base: None,
            brain_base_url: Some(DEFAULT_BRAIN_BASE_URL.to_string()),
            project_path: None,
        }
    }
}

impl Default for BrainProcessState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            url: Mutex::new(DEFAULT_BRAIN_BASE_URL.to_string()),
        }
    }
}

impl Drop for BrainProcessState {
    fn drop(&mut self) {
        if let Ok(child_slot) = self.child.get_mut() {
            if let Some(mut child) = child_slot.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

fn settings_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not find a home directory for Wall-E settings.".to_string())?;
    Ok(PathBuf::from(home).join(".wall-e"))
}

fn settings_path() -> Result<PathBuf, String> {
    Ok(settings_dir()?.join("settings.json"))
}

fn provider_key_name(provider: &str) -> Option<&'static str> {
    match provider {
        "openrouter" => Some("OPENROUTER_API_KEY"),
        "deepseek" => Some("DEEPSEEK_API_KEY"),
        "groq" => Some("GROQ_API_KEY"),
        _ => None,
    }
}

fn keychain_entry(provider: &str) -> Result<keyring::Entry, String> {
    let account = format!("provider:{provider}");
    keyring::Entry::new(KEYCHAIN_SERVICE, &account)
        .map_err(|err| format!("Could not access OS keychain for {provider}: {err}"))
}

fn read_settings() -> Result<AppSettings, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|err| format!("Could not read settings from {}: {err}", path.display()))?;
    serde_json::from_str(&raw)
        .map_err(|err| format!("Could not parse settings from {}: {err}", path.display()))
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn brain_port_from_url(url: &str) -> String {
    let without_path = url
        .trim()
        .trim_end_matches('/')
        .split('/')
        .next_back()
        .unwrap_or(DEFAULT_BRAIN_BASE_URL);

    without_path
        .rsplit(':')
        .next()
        .filter(|port| !port.is_empty() && port.chars().all(|char| char.is_ascii_digit()))
        .unwrap_or("8765")
        .to_string()
}

fn current_brain_status(
    state: &State<'_, BrainProcessState>,
    message: impl Into<String>,
) -> Result<BrainStatus, String> {
    let url = state
        .url
        .lock()
        .map_err(|_| "Brain process URL lock was poisoned.".to_string())?
        .clone();

    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| "Brain process lock was poisoned.".to_string())?;

    let mut running = false;
    let mut pid = None;

    if let Some(child) = child_guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_status)) => {
                *child_guard = None;
            }
            Ok(None) => {
                running = true;
                pid = Some(child.id());
            }
            Err(err) => {
                *child_guard = None;
                return Err(format!("Could not check brain process status: {err}"));
            }
        }
    }

    Ok(BrainStatus {
        running,
        pid,
        url,
        message: message.into(),
    })
}

fn write_settings(settings: &AppSettings) -> Result<(), String> {
    let dir = settings_dir()?;
    fs::create_dir_all(&dir).map_err(|err| {
        format!(
            "Could not create settings directory {}: {err}",
            dir.display()
        )
    })?;

    let path = settings_path()?;
    let raw = serde_json::to_string_pretty(settings)
        .map_err(|err| format!("Could not serialize settings: {err}"))?;
    fs::write(&path, raw)
        .map_err(|err| format!("Could not write settings to {}: {err}", path.display()))
}

#[tauri::command]
fn get_app_info() -> Result<AppInfo, String> {
    Ok(AppInfo {
        name: "Wall-E".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        settings_path: settings_path()?.display().to_string(),
    })
}

#[tauri::command]
fn load_settings() -> Result<AppSettings, String> {
    read_settings()
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<AppSettings, String> {
    if settings.provider.trim().is_empty() {
        return Err("Provider is required.".to_string());
    }

    if settings.model.trim().is_empty() {
        return Err("Model is required.".to_string());
    }

    if let Some(project_path) = settings.project_path.as_ref() {
        let path = PathBuf::from(project_path);
        if !path.exists() {
            return Err(format!("Project path does not exist: {project_path}"));
        }
        if !path.is_dir() {
            return Err(format!("Project path is not a directory: {project_path}"));
        }
    }

    write_settings(&settings)?;
    Ok(settings)
}

#[tauri::command]
fn get_provider_key_status(provider: String) -> Result<KeyStatus, String> {
    if provider_key_name(&provider).is_none() {
        return Ok(KeyStatus {
            provider,
            has_key: false,
            key_name: None,
        });
    }

    let entry = keychain_entry(&provider)?;
    let has_key = entry
        .get_password()
        .is_ok_and(|password| !password.is_empty());

    Ok(KeyStatus {
        key_name: provider_key_name(&provider).map(str::to_string),
        provider,
        has_key,
    })
}

#[tauri::command]
fn save_provider_key(request: SaveProviderKeyRequest) -> Result<KeyStatus, String> {
    if provider_key_name(&request.provider).is_none() {
        return Err(format!(
            "Provider does not use an API key: {}",
            request.provider
        ));
    }

    let api_key = request.api_key.trim();
    if api_key.is_empty() {
        return Err("API key cannot be empty.".to_string());
    }

    let entry = keychain_entry(&request.provider)?;
    entry
        .set_password(api_key)
        .map_err(|err| format!("Could not save API key in OS keychain: {err}"))?;

    get_provider_key_status(request.provider)
}

#[tauri::command]
fn delete_provider_key(request: ProviderKeyRequest) -> Result<KeyStatus, String> {
    if provider_key_name(&request.provider).is_none() {
        return Ok(KeyStatus {
            provider: request.provider,
            has_key: false,
            key_name: None,
        });
    }

    let entry = keychain_entry(&request.provider)?;
    match entry.delete_credential() {
        Ok(()) => {}
        Err(err) => {
            let message = err.to_string();
            if !message.to_lowercase().contains("not found") {
                return Err(format!("Could not delete API key from OS keychain: {err}"));
            }
        }
    }

    get_provider_key_status(request.provider)
}

#[tauri::command]
fn get_brain_status(state: State<'_, BrainProcessState>) -> Result<BrainStatus, String> {
    current_brain_status(&state, "Brain process status checked.")
}

#[tauri::command]
fn start_brain(
    state: State<'_, BrainProcessState>,
    request: StartBrainRequest,
) -> Result<BrainStatus, String> {
    let url = request
        .brain_base_url
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_BRAIN_BASE_URL.to_string());
    let port = brain_port_from_url(&url);

    {
        let mut url_guard = state
            .url
            .lock()
            .map_err(|_| "Brain process URL lock was poisoned.".to_string())?;
        *url_guard = url;
    }

    {
        let mut child_guard = state
            .child
            .lock()
            .map_err(|_| "Brain process lock was poisoned.".to_string())?;

        if let Some(child) = child_guard.as_mut() {
            match child.try_wait() {
                Ok(Some(_status)) => {
                    *child_guard = None;
                }
                Ok(None) => {
                    drop(child_guard);
                    return current_brain_status(&state, "Brain is already running.");
                }
                Err(err) => {
                    *child_guard = None;
                    return Err(format!("Could not check existing brain process: {err}"));
                }
            }
        }

        let child = Command::new("python3")
            .arg("-m")
            .arg("brain.server")
            .current_dir(repo_root())
            .env("WALL_E_BRAIN_HOST", "127.0.0.1")
            .env("WALL_E_BRAIN_PORT", port)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|err| format!("Could not start Wall-E brain process: {err}"))?;

        *child_guard = Some(child);
    }

    current_brain_status(&state, "Brain process started.")
}

#[tauri::command]
fn stop_brain(state: State<'_, BrainProcessState>) -> Result<BrainStatus, String> {
    {
        let mut child_guard = state
            .child
            .lock()
            .map_err(|_| "Brain process lock was poisoned.".to_string())?;

        if let Some(mut child) = child_guard.take() {
            if child
                .try_wait()
                .map_err(|err| format!("Could not check Wall-E brain process before stop: {err}"))?
                .is_none()
            {
                child
                    .kill()
                    .map_err(|err| format!("Could not stop Wall-E brain process: {err}"))?;
            }
            child
                .wait()
                .map_err(|err| format!("Could not finish stopping Wall-E brain process: {err}"))?;
        }
    }

    current_brain_status(&state, "Brain process stopped.")
}

#[tauri::command]
async fn check_for_update(
    app: AppHandle,
    state: State<'_, PendingUpdateState>,
) -> Result<UpdateStatus, String> {
    let current_version = app.package_info().version.to_string();
    let update = app
        .updater()
        .map_err(|err| format!("Could not initialize updater: {err}"))?
        .check()
        .await
        .map_err(|err| format!("Could not check for updates: {err}"))?;

    let status = update.as_ref().map_or_else(
        || UpdateStatus {
            available: false,
            current_version: current_version.clone(),
            version: None,
            notes: None,
            date: None,
            message: "Wall-E is up to date.".to_string(),
        },
        |update| UpdateStatus {
            available: true,
            current_version: current_version.clone(),
            version: Some(update.version.clone()),
            notes: update.body.clone(),
            date: update.date.map(|date| date.to_string()),
            message: format!("Wall-E {} is available.", update.version),
        },
    );

    *state
        .update
        .lock()
        .map_err(|_| "Pending update lock was poisoned.".to_string())? = update;

    Ok(status)
}

#[tauri::command]
async fn install_pending_update(
    state: State<'_, PendingUpdateState>,
) -> Result<UpdateStatus, String> {
    let update = state
        .update
        .lock()
        .map_err(|_| "Pending update lock was poisoned.".to_string())?
        .take()
        .ok_or_else(|| "No pending update. Check for updates first.".to_string())?;

    let version = update.version.clone();
    let current_version = update.current_version.clone();
    let notes = update.body.clone();
    let date = update.date.map(|date| date.to_string());

    update
        .download_and_install(|_chunk_length, _content_length| {}, || {})
        .await
        .map_err(|err| format!("Could not install update: {err}"))?;

    Ok(UpdateStatus {
        available: false,
        current_version,
        version: Some(version.clone()),
        notes,
        date,
        message: format!("Wall-E {version} installed. Restart Wall-E to finish updating."),
    })
}

#[tauri::command]
fn restart_app(app: AppHandle) {
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(BrainProcessState::default())
        .manage(PendingUpdateState::default())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            load_settings,
            save_settings,
            get_provider_key_status,
            save_provider_key,
            delete_provider_key,
            get_brain_status,
            start_brain,
            stop_brain,
            check_for_update,
            install_pending_update,
            restart_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running Wall-E desktop application");
}
