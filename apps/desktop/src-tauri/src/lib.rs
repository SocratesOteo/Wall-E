use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            load_settings,
            save_settings,
            get_provider_key_status,
            save_provider_key,
            delete_provider_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running Wall-E desktop application");
}
