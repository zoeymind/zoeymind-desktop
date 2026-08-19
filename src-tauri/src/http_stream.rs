/**
 * 通用 HTTP 流代理 —— 前端 AI SDK (openai/anthropic providers) 通过 nativeFetch
 * 把 fetch 转成 tauri invoke, Rust 侧走 reqwest 打服务商, 把响应字节按块 emit 事件.
 *
 * 事件模型 (每个请求独立 request_id):
 *   http:{id}:head   { status, headers }
 *   http:{id}:chunk  { bytes: base64 }
 *   http:{id}:done   {}
 *   http:{id}:error  { message }
 *
 * 前端订阅 head 后构造 Response, chunk 塞进 body ReadableStream, done/error 关流.
 */
use base64::Engine;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tokio::task::JoinHandle;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HttpStreamRequest {
  pub request_id: String,
  pub url: String,
  #[serde(default)]
  pub method: Option<String>,
  #[serde(default)]
  pub headers: HashMap<String, String>,
  #[serde(default)]
  pub body: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
struct HeadPayload {
  status: u16,
  headers: HashMap<String, String>,
}

#[derive(Debug, Serialize, Clone)]
struct ChunkPayload<'a> {
  bytes: &'a str,
}

#[derive(Debug, Serialize, Clone, Default)]
struct DonePayload {}

#[derive(Debug, Serialize, Clone)]
struct ErrorPayload<'a> {
  message: &'a str,
}

#[derive(Default)]
pub struct HttpAbortMap(pub Mutex<HashMap<String, JoinHandle<()>>>);

fn emit_head(app: &AppHandle, id: &str, payload: HeadPayload) {
  let _ = app.emit(&format!("http:{}:head", id), payload);
}

fn emit_chunk(app: &AppHandle, id: &str, bytes_b64: &str) {
  let _ = app.emit(
    &format!("http:{}:chunk", id),
    ChunkPayload { bytes: bytes_b64 },
  );
}

fn emit_done(app: &AppHandle, id: &str) {
  let _ = app.emit(&format!("http:{}:done", id), DonePayload::default());
}

fn emit_error(app: &AppHandle, id: &str, message: &str) {
  let _ = app.emit(&format!("http:{}:error", id), ErrorPayload { message });
}

async fn run_request(
  app: AppHandle,
  request_id: String,
  req: HttpStreamRequest,
) -> Result<(), String> {
  let method = req.method.as_deref().unwrap_or("POST").to_uppercase();
  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(300))
    .build()
    .map_err(|e| e.to_string())?;

  let mut builder = match method.as_str() {
    "GET" => client.get(&req.url),
    "POST" => client.post(&req.url),
    "PUT" => client.put(&req.url),
    "DELETE" => client.delete(&req.url),
    other => return Err(format!("unsupported method: {}", other)),
  };
  for (k, v) in req.headers.iter() {
    builder = builder.header(k.as_str(), v.as_str());
  }
  if let Some(body) = req.body {
    builder = builder.body(body);
  }

  let resp = builder.send().await.map_err(|e| e.to_string())?;
  let status = resp.status().as_u16();
  let mut headers: HashMap<String, String> = HashMap::new();
  for (name, value) in resp.headers().iter() {
    if let Ok(s) = value.to_str() {
      headers.insert(name.as_str().to_lowercase(), s.to_string());
    }
  }
  emit_head(&app, &request_id, HeadPayload { status, headers });

  let engine = base64::engine::general_purpose::STANDARD;
  let mut stream = resp.bytes_stream();
  while let Some(item) = stream.next().await {
    let chunk = item.map_err(|e| e.to_string())?;
    if chunk.is_empty() {
      continue;
    }
    let encoded = engine.encode(&chunk);
    emit_chunk(&app, &request_id, &encoded);
  }
  emit_done(&app, &request_id);
  Ok(())
}

#[tauri::command]
pub async fn http_stream_start(
  app: AppHandle,
  abort_map: State<'_, HttpAbortMap>,
  req: HttpStreamRequest,
) -> Result<(), String> {
  let request_id = req.request_id.clone();
  if let Ok(mut map) = abort_map.0.lock() {
    if let Some(h) = map.remove(&request_id) {
      h.abort();
    }
  }

  let app_task = app.clone();
  let id_task = request_id.clone();
  let handle = tokio::spawn(async move {
    if let Err(e) = run_request(app_task.clone(), id_task.clone(), req).await {
      emit_error(&app_task, &id_task, &e);
    }
  });

  if let Ok(mut map) = abort_map.0.lock() {
    map.insert(request_id, handle);
  }
  Ok(())
}

#[tauri::command]
pub async fn http_stream_abort(
  abort_map: State<'_, HttpAbortMap>,
  request_id: String,
) -> Result<(), String> {
  if let Ok(mut map) = abort_map.0.lock() {
    if let Some(h) = map.remove(&request_id) {
      h.abort();
    }
  }
  Ok(())
}
