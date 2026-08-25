use std::{
  collections::HashMap,
  fs,
  io::{BufRead, BufReader, Write},
  process::{Child, ChildStdin, Command, Stdio},
  sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
  },
  thread,
  time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

const PROCESS_EVENT: &str = "mcp:process";

fn config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map(|path| path.join("mcp.json"))
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn mcp_config_open(app: AppHandle) -> Result<(), String> {
  let path = config_path(&app)?;
  app
    .opener()
    .open_path(path.to_string_lossy(), None::<&str>)
    .map_err(|error| error.to_string())
}

#[derive(Default)]
pub struct McpProcessState {
  next_id: AtomicU64,
  processes: Arc<Mutex<HashMap<u64, ManagedProcess>>>,
}

struct ManagedProcess {
  child: Arc<Mutex<Child>>,
  stdin: Arc<Mutex<ChildStdin>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpConfig {
  #[serde(default)]
  mcp_servers: HashMap<String, McpServerConfig>,
}

#[derive(Deserialize)]
struct McpServerConfig {
  #[serde(rename = "type")]
  kind: Option<String>,
  command: Option<String>,
  #[serde(default)]
  args: Vec<String>,
  #[serde(default)]
  env: HashMap<String, String>,
  cwd: Option<String>,
  #[serde(default)]
  disabled: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProcessEvent {
  process_id: u64,
  kind: &'static str,
  data: Option<String>,
  code: Option<i32>,
}

fn emit(app: &AppHandle, process_id: u64, kind: &'static str, data: Option<String>, code: Option<i32>) {
  let _ = app.emit(
    PROCESS_EVENT,
    ProcessEvent {
      process_id,
      kind,
      data,
      code,
    },
  );
}

fn load_stdio_server(app: &AppHandle, server_name: &str) -> Result<McpServerConfig, String> {
  let path = config_path(app)?;
  let raw = fs::read_to_string(&path)
    .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
  let mut config: McpConfig =
    serde_json::from_str(&raw).map_err(|error| format!("invalid mcp.json: {error}"))?;
  let server = config
    .mcp_servers
    .remove(server_name)
    .ok_or_else(|| format!("MCP server {server_name} is not configured"))?;
  if server.disabled {
    return Err(format!("MCP server {server_name} is disabled"));
  }
  if matches!(server.kind.as_deref(), Some("http" | "sse")) {
    return Err(format!("MCP server {server_name} is not a stdio server"));
  }
  if server.command.as_deref().is_none_or(str::is_empty) {
    return Err(format!("MCP server {server_name} has no command"));
  }
  Ok(server)
}

fn read_lines(app: AppHandle, process_id: u64, kind: &'static str, reader: impl std::io::Read + Send + 'static) {
  thread::spawn(move || {
    for line in BufReader::new(reader).lines() {
      match line {
        Ok(line) => emit(&app, process_id, kind, Some(line), None),
        Err(error) => {
          emit(&app, process_id, "error", Some(error.to_string()), None);
          break;
        }
      }
    }
  });
}

#[tauri::command]
pub fn mcp_process_spawn(
  app: AppHandle,
  state: State<'_, McpProcessState>,
  server_name: String,
) -> Result<u64, String> {
  let server = load_stdio_server(&app, &server_name)?;
  let command = server.command.expect("validated command");
  let mut process = Command::new(command);
  process
    .args(server.args)
    .envs(server.env)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
  if let Some(cwd) = server.cwd {
    process.current_dir(cwd);
  }

  let mut child = process
    .spawn()
    .map_err(|error| format!("failed to start MCP server {server_name}: {error}"))?;
  let stdin = child.stdin.take().ok_or_else(|| "MCP stdin unavailable".to_string())?;
  let stdout = child.stdout.take().ok_or_else(|| "MCP stdout unavailable".to_string())?;
  let stderr = child.stderr.take().ok_or_else(|| "MCP stderr unavailable".to_string())?;
  let process_id = state.next_id.fetch_add(1, Ordering::Relaxed) + 1;
  let child = Arc::new(Mutex::new(child));
  state
    .processes
    .lock()
    .map_err(|_| "MCP process registry is unavailable".to_string())?
    .insert(
      process_id,
      ManagedProcess {
        child: Arc::clone(&child),
        stdin: Arc::new(Mutex::new(stdin)),
      },
    );

  read_lines(app.clone(), process_id, "stdout", stdout);
  read_lines(app.clone(), process_id, "stderr", stderr);

  let processes = Arc::clone(&state.processes);
  thread::spawn(move || loop {
    let status = child
      .lock()
      .ok()
      .and_then(|mut child| child.try_wait().ok())
      .flatten();
    if let Some(status) = status {
      if let Ok(mut processes) = processes.lock() {
        processes.remove(&process_id);
      }
      emit(&app, process_id, "close", None, status.code());
      break;
    }
    thread::sleep(Duration::from_millis(50));
  });

  Ok(process_id)
}

#[tauri::command]
pub fn mcp_process_write(
  state: State<'_, McpProcessState>,
  process_id: u64,
  message: String,
) -> Result<(), String> {
  let stdin = {
    let processes = state
      .processes
      .lock()
      .map_err(|_| "MCP process registry is unavailable".to_string())?;
    Arc::clone(
      &processes
        .get(&process_id)
        .ok_or_else(|| format!("MCP process {process_id} is not running"))?
        .stdin,
    )
  };
  let mut stdin = stdin.lock().map_err(|_| "MCP stdin is unavailable".to_string())?;
  stdin.write_all(message.as_bytes()).map_err(|error| error.to_string())?;
  stdin.write_all(b"\n").map_err(|error| error.to_string())?;
  stdin.flush().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn mcp_process_kill(
  state: State<'_, McpProcessState>,
  process_id: u64,
) -> Result<(), String> {
  let process = state
    .processes
    .lock()
    .map_err(|_| "MCP process registry is unavailable".to_string())?
    .remove(&process_id);
  if let Some(process) = process {
    process
      .child
      .lock()
      .map_err(|_| "MCP process is unavailable".to_string())?
      .kill()
      .map_err(|error| error.to_string())?;
  }
  Ok(())
}
