// Log 配置 —— 落盘到 <appConfig>/log-config.json.
//
// 设计要点:
//  * **级别**: tauri-plugin-log 的 fern::Dispatch 一旦 build 就不能改 level, 但
//    log crate 的全局 max_level 可以随时 set_max_level. 所以 plugin 初始化时给
//    Trace (最松), 真正生效的级别通过 log::set_max_level 控制, 前端切换立即生效.
//  * **目录**: 默认走 tauri-plugin-log 的 LogDir target (~/Library/Logs/{bundleId} 等).
//    用户可以在 UI 里改, 保存到 config.dir; 但目录切换需要重启才能生效
//    (fern::Dispatch 里 RotatingFile 在 build 时就打开了 File handle, 不支持热切).
//    LogInfo 同时返回 activeDir (当前正写的) 和 configuredDir (下次重启使用的),
//    前端据此提示"重启后生效".
//  * **清空**: 只删 .log / .log.bak / 含 .log. 的文件, 不动其他内容.

use std::path::PathBuf;
use std::sync::OnceLock;

use log::LevelFilter;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

const CONFIG_FILE_NAME: &str = "log-config.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PersistedLevel {
  Off,
  Error,
  Warn,
  Info,
  Debug,
  Trace,
}

impl PersistedLevel {
  pub fn to_filter(self) -> LevelFilter {
    match self {
      PersistedLevel::Off => LevelFilter::Off,
      PersistedLevel::Error => LevelFilter::Error,
      PersistedLevel::Warn => LevelFilter::Warn,
      PersistedLevel::Info => LevelFilter::Info,
      PersistedLevel::Debug => LevelFilter::Debug,
      PersistedLevel::Trace => LevelFilter::Trace,
    }
  }

  fn default_for_build() -> Self {
    if cfg!(debug_assertions) {
      PersistedLevel::Debug
    } else {
      PersistedLevel::Info
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogConfig {
  pub level: PersistedLevel,
  /// 用户自定义日志目录; None / 空 = 用 OS 默认 (tauri-plugin-log 的 LogDir target).
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub dir: Option<String>,
}

impl Default for LogConfig {
  fn default() -> Self {
    Self {
      level: PersistedLevel::default_for_build(),
      dir: None,
    }
  }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir.join(CONFIG_FILE_NAME))
}

/// 读配置; 任意错误 (不存在 / JSON 坏) 都退回默认值, 保证启动路径永不失败.
pub fn load(app: &AppHandle) -> LogConfig {
  let Ok(path) = config_path(app) else {
    return LogConfig::default();
  };
  let Ok(bytes) = std::fs::read(&path) else {
    return LogConfig::default();
  };
  serde_json::from_slice(&bytes).unwrap_or_default()
}

fn save(app: &AppHandle, cfg: &LogConfig) -> Result<(), String> {
  let path = config_path(app)?;
  let json = serde_json::to_vec_pretty(cfg).map_err(|e| e.to_string())?;
  std::fs::write(&path, json).map_err(|e| e.to_string())
}

/// OS 默认日志目录 (LogDir target 会用这个).
fn default_log_dir(app: &AppHandle) -> Result<PathBuf, String> {
  app.path().app_log_dir().map_err(|e| e.to_string())
}

/// 根据当前 config 推算的目录 (配置了 dir 就用 dir, 否则默认).
/// setup() 会调用这个并把结果 stash 起来供后续 UI 查询.
pub fn resolved_log_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let cfg = load(app);
  match cfg.dir.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
    Some(custom) => Ok(PathBuf::from(custom)),
    None => default_log_dir(app),
  }
}

/// 启动时定住的活跃目录. plugin 初始化前 setup() 调 [`stash_active_dir`] 一次.
/// 需要 AppHandle 才能算出, 属于"运行时输入"场景, 用 OnceLock 而不是 LazyLock.
static ACTIVE_LOG_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn stash_active_dir(dir: PathBuf) {
  let _ = ACTIVE_LOG_DIR.set(dir);
}

fn active_dir_snapshot(app: &AppHandle) -> Result<PathBuf, String> {
  if let Some(dir) = ACTIVE_LOG_DIR.get() {
    return Ok(dir.clone());
  }
  // 兜底: 未 stash 时按当前 config 推算 (只应发生在测试 / 极早期启动).
  resolved_log_dir(app)
}

/// 扫描目录里所有 log 文件的总字节数. 目录不存在 / 读不到 → 0.
fn compute_log_size(dir: &std::path::Path) -> u64 {
  let Ok(entries) = std::fs::read_dir(dir) else {
    return 0;
  };
  let mut total = 0u64;
  for entry in entries.flatten() {
    let path = entry.path();
    let is_log = path
      .file_name()
      .and_then(|s| s.to_str())
      .map(|name| name.ends_with(".log") || name.contains(".log.") || name.ends_with(".log.bak"))
      .unwrap_or(false);
    if !is_log {
      continue;
    }
    if let Ok(meta) = entry.metadata() {
      total = total.saturating_add(meta.len());
    }
  }
  total
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogInfo {
  pub level: PersistedLevel,
  /// 本次会话真正写日志的目录 (启动时定住).
  pub active_dir: String,
  /// 用户配置的自定义目录; None 表示走 OS 默认.
  pub configured_dir: Option<String>,
  /// OS 默认日志目录, 用于 UI 展示 / reset.
  pub default_dir: String,
  /// 活跃目录里所有 log 文件的总字节数. 清空 / rotate 后前端主动 refresh 拿新值.
  pub size_bytes: u64,
}

#[tauri::command]
pub fn get_log_config(app: AppHandle) -> Result<LogInfo, String> {
  let cfg = load(&app);
  let default = default_log_dir(&app)?;
  let active = active_dir_snapshot(&app)?;
  let size_bytes = compute_log_size(&active);
  Ok(LogInfo {
    level: cfg.level,
    active_dir: active.to_string_lossy().into_owned(),
    configured_dir: cfg.dir.clone(),
    default_dir: default.to_string_lossy().into_owned(),
    size_bytes,
  })
}

/// 用系统文件管理器打开当前会话正在写入的日志目录。
///
/// 路径只从原生侧的活跃日志配置读取，不接受 WebView 参数，避免为通用
/// `openPath` 放宽到任意用户自定义路径。
#[tauri::command]
pub fn open_log_dir(app: AppHandle) -> Result<(), String> {
  let dir = active_dir_snapshot(&app)?;
  app
    .opener()
    .open_path(dir.to_string_lossy(), None::<&str>)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_log_level(app: AppHandle, level: PersistedLevel) -> Result<(), String> {
  let mut cfg = load(&app);
  cfg.level = level;
  save(&app, &cfg)?;
  log::set_max_level(level.to_filter());
  log::info!("log level changed to {:?}", level);
  Ok(())
}

/// 设置自定义日志目录. 传空串 (或纯空格) 视为"重置为默认".
/// 目录切换需要重启才能生效, 命令本身只负责持久化 + 建目录.
#[tauri::command]
pub fn set_log_dir(app: AppHandle, dir: String) -> Result<(), String> {
  let trimmed = dir.trim();
  let mut cfg = load(&app);
  if trimmed.is_empty() {
    cfg.dir = None;
    log::info!("log dir reset to default (takes effect on restart)");
  } else {
    let path = PathBuf::from(trimmed);
    // 提前建目录, 避免下次启动 plugin 拿到不存在的路径炸掉.
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    cfg.dir = Some(trimmed.to_string());
    log::info!("log dir set to {} (takes effect on restart)", trimmed);
  }
  save(&app, &cfg)
}

/// 删除 log 目录下所有 .log 文件 (含 rotate 出来的 `app_YYYY-MM-DD_...log`).
/// 用当前活跃目录, 不是 config 里那个 (config 可能已改但没重启).
#[tauri::command]
pub fn clear_logs(app: AppHandle) -> Result<u32, String> {
  let dir = active_dir_snapshot(&app)?;
  if !dir.exists() {
    return Ok(0);
  }
  let mut removed = 0u32;
  for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
    let Ok(entry) = entry else { continue };
    let path = entry.path();
    let is_log_file = path
      .file_name()
      .and_then(|s| s.to_str())
      .map(|name| name.ends_with(".log") || name.contains(".log.") || name.ends_with(".log.bak"))
      .unwrap_or(false);
    if is_log_file && std::fs::remove_file(&path).is_ok() {
      removed += 1;
    }
  }
  log::info!("cleared {} log file(s)", removed);
  Ok(removed)
}
