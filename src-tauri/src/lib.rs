use std::collections::HashMap;

use tauri::{Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

mod chat_stream;
mod http_stream;
use chat_stream::AbortMap;
use http_stream::HttpAbortMap;

/**
 * 走 native reqwest 请求, 绕开 webview CORS. 前端 invoke('http_get_json', {url, headers}).
 * 用于拉取 provider 模型列表: 部分服务商 OPTIONS 预检返回 401 不给通过.
 */
#[tauri::command]
async fn http_get_json(
  url: String,
  headers: HashMap<String, String>,
) -> Result<String, String> {
  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(30))
    .build()
    .map_err(|e| e.to_string())?;

  let mut req = client.get(&url);
  for (k, v) in headers.iter() {
    req = req.header(k.as_str(), v.as_str());
  }
  let resp = req.send().await.map_err(|e| e.to_string())?;
  let status = resp.status();
  let text = resp.text().await.map_err(|e| e.to_string())?;
  if !status.is_success() {
    return Err(format!("HTTP {}: {}", status, text));
  }
  Ok(text)
}
fn migrations() -> Vec<Migration> {
  vec![Migration {
    version: 1,
    description: "initial schema: projects/folders/snapshots/chat/ai/mcp",
    sql: r#"
      -- 项目索引：每个 .zmind 文件在磁盘上的注册记录。
      -- path = 绝对路径，用户可以在 Finder 里移动/删除，运行时通过
      -- fs::exists 判断，缺失时 UI 显示失效卡片。
      CREATE TABLE IF NOT EXISTS projects_index (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        is_starred INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        tags_json TEXT NOT NULL DEFAULT '[]',
        node_count INTEGER NOT NULL DEFAULT 0,
        size INTEGER NOT NULL DEFAULT 0,
        mtime INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_opened_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_projects_folder ON projects_index(folder_id);
      CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects_index(updated_at);

      -- 文件夹：虚拟标签（不映射真实目录），扁平结构。
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      -- 快照：思维导图的历史版本，tree_gzip 存 gzip 压缩后的节点树 JSON。
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects_index(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,  -- 'manual' | 'auto'
        title TEXT,
        tree_gzip BLOB NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id, created_at);

      -- AI Chat 会话
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects_index(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_conv_project ON chat_conversations(project_id, updated_at);

      -- AI Chat 消息
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL, -- 'user' | 'assistant' | 'tool' | 'system'
        content_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages(conversation_id, created_at);

      -- 记忆索引（RAG）: 向量 blob + 文本 + 元数据
      CREATE TABLE IF NOT EXISTS ai_memory_index (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,       -- 'chat' | 'node' | 'doc' 等
        content TEXT NOT NULL,
        embedding BLOB,           -- Float32Array raw bytes
        meta_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memory_kind ON ai_memory_index(kind, created_at);

      -- MCP servers 配置
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'stdio', -- 'stdio' | 'sse' | 'http'
        command TEXT,
        args_json TEXT NOT NULL DEFAULT '[]',
        url TEXT,
        headers_json TEXT NOT NULL DEFAULT '{}',
        preset TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 通用 KV：UI 偏好、last-open 等 lightweight state
      CREATE TABLE IF NOT EXISTS app_kv (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    "#,
    kind: MigrationKind::Up,
  }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(AbortMap::default())
    .manage(HttpAbortMap::default())
    // Single-instance: OS 双击 .zmind (macOS: fileAssociations 转 open event;
    // Windows/Linux: argv). 第二次启动时把路径 emit 到前端 'zm:open-file' 事件,
    // 由 useTabs.openTab 命中已有 tab 就激活, 否则新开.
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      log::info!("second instance launched, argv={:?}", argv);
      // argv[0] 是 exe 路径, argv[1..] 是文件参数
      let paths: Vec<&str> = argv.iter().skip(1).map(|s| s.as_str()).collect();
      if !paths.is_empty() {
        let _ = app.emit("zm:open-file", &paths);
      }
      // 把窗口拉到前台
      if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
        let _ = w.unminimize();
      }
    }))
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:app.db", migrations())
        .build(),
    )
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      http_get_json,
      chat_stream::chat_stream,
      chat_stream::chat_stream_abort,
      http_stream::http_stream_start,
      http_stream::http_stream_abort
    ])
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        #[cfg(target_os = "windows")]
        {
          let _ = window.set_decorations(false);
        }
        log::info!("tauri window ready: {:?}", window.label());
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
