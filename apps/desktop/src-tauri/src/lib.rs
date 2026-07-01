use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const DEFAULT_MODEL: &str = "openrouter/qwen/qwen3-coder";

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
    project_path: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            model: DEFAULT_MODEL.to_string(),
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            load_settings,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running Wall-E desktop application");
}
