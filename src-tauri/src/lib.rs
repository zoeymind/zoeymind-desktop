use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        #[cfg(target_os = "macos")]
        {
          // macOS: 使用 Overlay 样式，保留原生按钮
          let _ = window.set_title_bar_style(tauri::TitleBarStyle::Overlay);
        }
        
        #[cfg(target_os = "windows")]
        {
          // Windows: 禁用原生装饰，使用自定义标题栏
          let _ = window.set_decorations(false);
        }
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
