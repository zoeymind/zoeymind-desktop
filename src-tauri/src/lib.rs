use std::{
  collections::HashMap,
  path::{Path, PathBuf},
  sync::Mutex,
};

use tauri::{Emitter, Manager, State};
use tauri_plugin_sql::{Migration, MigrationKind};

mod atomic_file;
mod chat_stream;
mod http_stream;
use chat_stream::AbortMap;
use http_stream::HttpAbortMap;

#[derive(Default)]
struct PendingOpenFiles(Mutex<PendingOpenFilesInner>);

#[derive(Default)]
struct PendingOpenFilesInner {
  frontend_ready: bool,
  paths: Vec<String>,
}

fn is_zmind_file(path: &Path) -> bool {
  path.extension()
    .and_then(|extension| extension.to_str())
    .is_some_and(|extension| extension.eq_ignore_ascii_case("zmind"))
}

fn path_from_open_argument(argument: &str) -> Option<PathBuf> {
  if argument.starts_with('-') {
    return None;
  }
  if let Ok(url) = url::Url::parse(argument) {
    return url.to_file_path().ok().filter(|path| is_zmind_file(path));
  }
  let path = PathBuf::from(argument);
  is_zmind_file(&path).then_some(path)
}

fn enqueue_open_files(app: &tauri::AppHandle, paths: impl IntoIterator<Item = PathBuf>) {
  let paths = paths
    .into_iter()
    .filter(|path| is_zmind_file(path))
    .map(|path| path.to_string_lossy().into_owned())
    .collect::<Vec<_>>();
  if paths.is_empty() {
    return;
  }
  let emit_paths = if let Ok(mut pending) = app.state::<PendingOpenFiles>().0.lock() {
    if pending.frontend_ready {
      Some(paths)
    } else {
      for path in paths {
        if !pending.paths.contains(&path) {
          pending.paths.push(path);
        }
      }
      None
    }
  } else {
    Some(paths)
  };
  if let Some(paths) = emit_paths {
    let _ = app.emit("zm:open-file", paths);
  }
}

#[tauri::command]
fn take_pending_open_files(pending: State<'_, PendingOpenFiles>) -> Vec<String> {
  pending.0.lock().map(|mut pending| {
    pending.frontend_ready = true;
    std::mem::take(&mut pending.paths)
  }).unwrap_or_default()
}

#[cfg(test)]
mod open_file_tests {
  use super::*;

  #[test]
  fn accepts_case_insensitive_zmind_paths() {
    assert_eq!(
      path_from_open_argument("/vault/Plan.ZMIND"),
      Some(PathBuf::from("/vault/Plan.ZMIND"))
    );
  }

  #[test]
  fn accepts_file_urls() {
    assert_eq!(
      path_from_open_argument("file:///tmp/Plan.zmind"),
      Some(PathBuf::from("/tmp/Plan.zmind"))
    );
  }

  #[test]
  fn rejects_flags_other_urls_and_unrelated_files() {
    assert_eq!(path_from_open_argument("--inspect"), None);
    assert_eq!(path_from_open_argument("https://zoeymind.com/Plan.zmind"), None);
    assert_eq!(path_from_open_argument("/tmp/Plan.txt"), None);
  }
}

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

const RELEASES_API_URL: &str =
  "https://api.github.com/repos/zoeymind/zoeymind-desktop/releases/latest";

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LatestRelease {
  tag_name: String,
  html_url: String,
  name: Option<String>,
  published_at: Option<String>,
}

/** 查询 GitHub 最新正式 Release。固定仓库地址，避免把通用 HTTP 代理暴露给 UI。 */
#[tauri::command]
async fn get_latest_release() -> Result<LatestRelease, String> {
  let response = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(10))
    .build()
    .map_err(|error| error.to_string())?
    .get(RELEASES_API_URL)
    .header(reqwest::header::USER_AGENT, "ZoeyMind-Desktop")
    .header(reqwest::header::ACCEPT, "application/vnd.github+json")
    .send()
    .await
    .map_err(|error| error.to_string())?;

  let status = response.status();
  if !status.is_success() {
    return Err(format!("GitHub Releases API returned {status}"));
  }

  response.json().await.map_err(|error| error.to_string())
}

#[tauri::command]
fn frontend_ready(app: tauri::AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;
  window.show().map_err(|error| error.to_string())?;
  window.set_focus().map_err(|error| error.to_string())
}

fn migrations() -> Vec<Migration> {
  vec![
    Migration {
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
    },
    Migration {
      version: 2,
      description: "prompts library",
      sql: r#"
      -- 用户自定义提示词。桌面端单人本地库, 不做公开分享 / 多用户 / 社区.
      -- is_enabled=1 的会被拼进 system prompt 前置 (在 useAIChatV2Store.mergedUserPrompt).
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_enabled INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts(updated_at);
    "#,
      kind: MigrationKind::Up,
    },
  ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(AbortMap::default())
    .manage(HttpAbortMap::default())
    .manage(PendingOpenFiles::default())
    // Single-instance: OS 双击 .zmind (macOS: fileAssociations 转 open event;
    // Windows/Linux: argv). 第二次启动时把路径 emit 到前端 'zm:open-file' 事件,
    // 由 useTabs.openTab 命中已有 tab 就激活, 否则新开.
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      log::info!("second instance launched, argv={:?}", argv);
      enqueue_open_files(
        app,
        argv.iter()
          .skip(1)
          .filter_map(|argument| path_from_open_argument(argument)),
      );
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.unminimize();
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
      atomic_file::write_file_atomically,
      http_get_json,
      get_latest_release,
      frontend_ready,
      take_pending_open_files,
      chat_stream::chat_stream,
      chat_stream::chat_stream_abort,
      http_stream::http_stream_start,
      http_stream::http_stream_abort
    ])
    .setup(|app| {
      #[cfg(any(windows, target_os = "linux"))]
      enqueue_open_files(
        app.handle(),
        std::env::args()
          .skip(1)
          .filter_map(|argument| path_from_open_argument(&argument)),
      );
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
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      #[cfg(target_os = "macos")]
      if let tauri::RunEvent::Opened { urls } = event {
        enqueue_open_files(app, urls.into_iter().filter_map(|url| url.to_file_path().ok()));
      }
    });
}
