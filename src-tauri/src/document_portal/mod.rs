use std::{
  collections::HashMap,
  fs::{self, OpenOptions},
  io::{BufReader, Read, Write},
  net::{TcpListener, TcpStream},
  path::{Path, PathBuf},
  sync::{atomic::{AtomicBool, Ordering}, mpsc, Arc, Mutex},
  thread,
  time::Duration,
};

use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

const DESCRIPTOR_FILE: &str = "document-portal-broker.json";
const REQUEST_EVENT: &str = "document-portal:request";
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(15);
const READ_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_HEADER_BYTES: usize = 8 * 1024;
const MAX_HEADER_COUNT: usize = 32;
const MAX_BODY_BYTES: usize = 1024 * 1024;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PortalRequest {
  request_id: String,
  tool: String,
  input: Value,
}

#[derive(Deserialize)]
struct HttpEnvelope {
  tool: String,
  input: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Descriptor<'a> {
  version: u8,
  pid: u32,
  port: u16,
  token: &'a str,
}


#[derive(Default)]
pub struct DocumentPortalBrokerState(Mutex<Option<DocumentPortalBroker>>);

pub struct DocumentPortalBroker {
  descriptor_path: PathBuf,
  pending: Arc<Mutex<HashMap<String, mpsc::Sender<Value>>>>,
  closed: Arc<AtomicBool>,
}

impl DocumentPortalBroker {
  fn start(app: &AppHandle) -> Result<Self, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    listener.set_nonblocking(true).map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    let directory = app.path().app_local_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let descriptor_path = directory.join(DESCRIPTOR_FILE);
    let _ = fs::remove_file(&descriptor_path);
    let mut token_bytes = [0_u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut token_bytes);
    let token = token_bytes.iter().map(|byte| format!("{byte:02x}")).collect::<String>();
    write_descriptor(&descriptor_path, port, &token)?;

    let pending = Arc::new(Mutex::new(HashMap::new()));
    let closed = Arc::new(AtomicBool::new(false));
    let thread_app = app.clone();
    let thread_token = token.clone();
    let thread_pending = Arc::clone(&pending);
    let thread_closed = Arc::clone(&closed);
    thread::spawn(move || {
      while !thread_closed.load(Ordering::Relaxed) {
        match listener.accept() {
          Ok((stream, _)) => {
            let app = thread_app.clone();
            let token = thread_token.clone();
            let pending = Arc::clone(&thread_pending);
            thread::spawn(move || serve(stream, &app, &token, &pending));
          }
          Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(25)),
          Err(_) => break,
        }
      }
    });

    Ok(Self { descriptor_path, pending, closed })
  }

  pub fn respond(&self, request_id: String, response: Value) -> Result<(), String> {
    let sender = self.pending.lock().map_err(|_| "Broker pending state is unavailable".to_string())?.remove(&request_id);
    sender.ok_or_else(|| "Unknown or expired Portal request".to_string())?.send(response).map_err(|_| "Portal request receiver closed".to_string())
  }

  pub fn close(&self) {
    self.closed.store(true, Ordering::Relaxed);
    let _ = fs::remove_file(&self.descriptor_path);
  }
}

impl Drop for DocumentPortalBroker {
  fn drop(&mut self) { self.close(); }
}


pub fn initialize(app: &AppHandle, state: &DocumentPortalBrokerState) -> Result<(), String> {
  *state.0.lock().map_err(|_| "Document Portal Broker state is unavailable".to_string())? =
    Some(DocumentPortalBroker::start(app)?);
  Ok(())
}


#[tauri::command]
pub fn document_portal_respond(
  broker: State<'_, DocumentPortalBrokerState>,
  request_id: String,
  response: Value,
) -> Result<(), String> {
  broker.0.lock().map_err(|_| "Document Portal Broker state is unavailable".to_string())?.as_ref().ok_or_else(|| "External automation is disabled".to_string())?.respond(request_id, response)
}

fn write_descriptor(path: &Path, port: u16, token: &str) -> Result<(), String> {
  let payload = serde_json::to_vec(&Descriptor { version: 1, pid: std::process::id(), port, token }).map_err(|error| error.to_string())?;
  let mut nonce = [0_u8; 16];
  rand::rngs::OsRng.fill_bytes(&mut nonce);
  let temporary = path.with_extension(format!("tmp-{}", nonce.iter().map(|byte| format!("{byte:02x}")).collect::<String>()));
  #[cfg(unix)]
  use std::os::unix::fs::OpenOptionsExt;
  let mut options = OpenOptions::new();
  options.write(true).create_new(true);
  #[cfg(unix)]
  options.mode(0o600);
  let result = (|| -> std::io::Result<()> {
    let mut file = options.open(&temporary)?;
    file.write_all(&payload)?;
    file.sync_all()?;
    fs::rename(&temporary, path)
  })();
  if result.is_err() { let _ = fs::remove_file(&temporary); }
  result.map_err(|error| error.to_string())
}

#[derive(Debug, PartialEq)]
enum RequestRejection { Unauthorized, Invalid }

fn parse_content_length(values: &[String]) -> Option<usize> {
  if values.len() != 1 || values[0].is_empty() || !values[0].bytes().all(|byte| byte.is_ascii_digit()) { return None; }
  let length = values[0].parse::<usize>().ok()?;
  (length <= MAX_BODY_BYTES).then_some(length)
}

fn classify_request(request_line: &str, authorization: Option<&str>, headers: &[(String, String)], token: &str) -> Result<usize, RequestRejection> {
  if request_line != "POST /v1/document-portal HTTP/1.1" || authorization != Some(&format!("Bearer {token}")) { return Err(RequestRejection::Unauthorized); }
  let content_lengths = headers.iter().filter_map(|(name, value)| name.eq_ignore_ascii_case("content-length").then_some(value.clone())).collect::<Vec<_>>();
  parse_content_length(&content_lengths).ok_or(RequestRejection::Invalid)
}

fn read_header_line(reader: &mut BufReader<TcpStream>) -> std::io::Result<String> {
  let mut bytes = Vec::with_capacity(128);
  loop {
    let mut byte = [0_u8; 1];
    reader.read_exact(&mut byte)?;
    if bytes.len() == MAX_HEADER_BYTES { return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "header too large")); }
    bytes.push(byte[0]);
    if bytes.ends_with(b"\r\n") { return String::from_utf8(bytes).map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "header is not utf-8")); }
  }
}

fn serve(mut stream: TcpStream, app: &AppHandle, token: &str, pending: &Arc<Mutex<HashMap<String, mpsc::Sender<Value>>>>) {
  if stream.set_read_timeout(Some(READ_TIMEOUT)).is_err() { return; }
  if stream.set_write_timeout(Some(READ_TIMEOUT)).is_err() { return; }
  let mut reader = BufReader::new(match stream.try_clone() { Ok(value) => value, Err(_) => return });
  let request_line = match read_header_line(&mut reader) { Ok(line) => line, Err(_) => { write_response(&mut stream, 400, invalid_envelope()); return; } };
  let mut authorization = None;
  let mut headers = Vec::new();
  let mut header_bytes = request_line.len();
  for _ in 0..MAX_HEADER_COUNT {
    let line = match read_header_line(&mut reader) { Ok(line) => line, Err(_) => { write_response(&mut stream, 400, invalid_envelope()); return; } };
    header_bytes = match header_bytes.checked_add(line.len()) { Some(length) if length <= MAX_HEADER_BYTES => length, _ => { write_response(&mut stream, 400, invalid_envelope()); return; } };
    if line == "\r\n" { break; }
    let Some((name, value)) = line.strip_suffix("\r\n").and_then(|line| line.split_once(':')) else { write_response(&mut stream, 400, invalid_envelope()); return; };
    let value = value.trim().to_string();
    if name.eq_ignore_ascii_case("authorization") { authorization = Some(value.clone()); }
    headers.push((name.to_string(), value));
  }
  if headers.len() == MAX_HEADER_COUNT { write_response(&mut stream, 400, invalid_envelope()); return; }
  let content_length = match classify_request(request_line.trim_end(), authorization.as_deref(), &headers, token) {
    Ok(length) => length,
    Err(RequestRejection::Unauthorized) => { write_response(&mut stream, 401, json!({"success":false,"errorCode":"BROKER_UNAUTHORIZED","error":"Document Portal broker authorization failed"})); return; }
    Err(RequestRejection::Invalid) => { write_response(&mut stream, 400, invalid_envelope()); return; }
  };
  let mut body = vec![0; content_length];
  if reader.read_exact(&mut body).is_err() { write_response(&mut stream, 400, invalid_envelope()); return; }
  let envelope: HttpEnvelope = match serde_json::from_slice::<HttpEnvelope>(&body) { Ok(value) if valid_tool(&value.tool) => value, _ => { write_response(&mut stream, 400, invalid_envelope()); return; } };
  let request_id = format!("{}-{}", std::process::id(), rand::random::<u64>());
  let (sender, receiver) = mpsc::channel();
  if pending.lock().map(|mut entries| entries.insert(request_id.clone(), sender)).is_err() { write_response(&mut stream, 503, unavailable()); return; }
  if app.emit(REQUEST_EVENT, PortalRequest { request_id: request_id.clone(), tool: envelope.tool, input: envelope.input }).is_err() {
    let _ = pending.lock().map(|mut entries| entries.remove(&request_id));
    write_response(&mut stream, 503, unavailable());
    return;
  }
  match receiver.recv_timeout(RESPONSE_TIMEOUT) {
    Ok(response) => write_response(&mut stream, 200, response),
    Err(_) => { let _ = pending.lock().map(|mut entries| entries.remove(&request_id)); write_response(&mut stream, 504, json!({"success":false,"errorCode":"BROKER_TIMEOUT","error":"Document Portal did not respond before timeout"})); }
  }
}

fn valid_tool(tool: &str) -> bool {
  matches!(
    tool,
    "projects" | "activate_project" | "query_current_mindmap" | "edit_current_mindmap"
  )
}
fn invalid_envelope() -> Value { json!({"success":false,"errorCode":"INVALID_REQUEST","error":"Expected a Document Portal tool request"}) }
fn unavailable() -> Value { json!({"success":false,"errorCode":"BROKER_UNAVAILABLE","error":"ZoeyMind Document Portal is not ready"}) }
fn write_response(stream: &mut TcpStream, status: u16, body: Value) {
  if let Ok(body) = serde_json::to_vec(&body) { let reason = match status { 200 => "OK", 400 => "Bad Request", 401 => "Unauthorized", 403 => "Forbidden", 503 => "Service Unavailable", _ => "Gateway Timeout" }; let _ = write!(stream, "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()); let _ = stream.write_all(&body); }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn accepts_only_portal_tools() {
    assert!(valid_tool("projects"));
    assert!(valid_tool("activate_project"));
    assert!(valid_tool("query_current_mindmap"));
    assert!(valid_tool("edit_current_mindmap"));
    assert!(!valid_tool("edit"));
    assert!(!valid_tool("delete"));
  }


  #[test]
  fn errors_are_stable() { assert_eq!(invalid_envelope()["errorCode"], "INVALID_REQUEST"); assert_eq!(unavailable()["errorCode"], "BROKER_UNAVAILABLE"); }

  #[test]
  fn content_length_requires_exactly_one_decimal_value_within_limit() {
    assert_eq!(parse_content_length(&["1024".to_string()]), Some(1024));
    assert_eq!(parse_content_length(&["1024".to_string(), "1024".to_string()]), None);
    assert_eq!(parse_content_length(&["-1".to_string()]), None);
    assert_eq!(parse_content_length(&[" 1024".to_string()]), None);
    assert_eq!(parse_content_length(&[(MAX_BODY_BYTES + 1).to_string()]), None);
  }

  #[test]
  fn unauthenticated_huge_length_is_rejected_before_body_allocation() {
    let headers = vec![("content-length".to_string(), (usize::MAX).to_string())];
    assert_eq!(classify_request("POST /v1/document-portal HTTP/1.1", None, &headers, "token"), Err(RequestRejection::Unauthorized));
  }

  #[test]
  fn request_rejects_malformed_or_oversized_headers() {
    assert_eq!(classify_request("POST /v1/document-portal HTTP/1.1", Some("Bearer token"), &[("content-length".to_string(), "oops".to_string())], "token"), Err(RequestRejection::Invalid));
    assert_eq!(classify_request("POST /v1/document-portal HTTP/1.1", Some("Bearer token"), &[("content-length".to_string(), (MAX_BODY_BYTES + 1).to_string())], "token"), Err(RequestRejection::Invalid));
  }
}
