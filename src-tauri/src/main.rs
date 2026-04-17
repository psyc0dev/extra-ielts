#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]
use tauri::Manager as _;
use msedge_tts::{tts::{client::connect, SpeechConfig}, voice::get_voices_list};
use base64::{engine::general_purpose::STANDARD, Engine};

#[tauri::command]
async fn speak_text(text: String, voice_name: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let voices = get_voices_list().map_err(|e| e.to_string())?;
        let voice = voices
            .iter()
            .find(|v| v.name.contains(&voice_name))
            .or_else(|| voices.iter().find(|v| v.locale.as_deref().map_or(false, |l| l.starts_with("en-US"))))
            .ok_or("Voice not found")?;
        let config = SpeechConfig::from(voice);
        let mut client = connect().map_err(|e| e.to_string())?;
        let audio = client.synthesize(&text, &config).map_err(|e| e.to_string())?;
        Ok(STANDARD.encode(&audio.audio_bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            window.eval("
                document.addEventListener('contextmenu', (e) => e.preventDefault());
            ").unwrap();

            #[cfg(target_os = "linux")]
            {
                if std::env::var("DISPLAY").is_err() && std::env::var("WAYLAND_DISPLAY").is_err() {
                    let _ = window.set_transparent(false);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![speak_text])
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
