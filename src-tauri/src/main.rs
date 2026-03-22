#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            window.eval("
                document.addEventListener('contextmenu', (e) => e.preventDefault());
            ").unwrap();

            Ok(())
        })
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
