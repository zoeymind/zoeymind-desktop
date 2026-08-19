/**
 * 桌面端 AI Chat streaming —— 走 native reqwest 从各 provider 拉 SSE / JSONL 流,
 * 每个 chunk 通过 tauri emit 事件回前端 (无 CORS).
 *
 * 事件模型:
 *   - "chat:{id}:delta"  { text: string }        (每次 provider 吐字都 emit)
 *   - "chat:{id}:tool"   { name, arguments }     (tool call, openai/anthropic 才有)
 *   - "chat:{id}:done"   { finish_reason, usage } (流结束)
 *   - "chat:{id}:error"  { message: string }     (网络 / HTTP / 解析失败)
 *
 * 前端 useDesktopChat 订阅这些事件累积消息, invoke 'chat_stream_abort' 取消.
 */
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tokio::task::JoinHandle;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatProvider {
  pub kind: String, // "openai" | "openai-compatible" | "anthropic" | "ollama" | "gemini"
  #[serde(default)]
  pub base_url: Option<String>,
  #[serde(default)]
  pub api_key: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ChatMessage {
  pub role: String, // "user" | "assistant" | "system"
  pub content: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
  pub request_id: String,
  pub provider: ChatProvider,
  pub model: String,
  pub messages: Vec<ChatMessage>,
  #[serde(default)]
  pub temperature: Option<f32>,
  #[serde(default)]
  pub max_tokens: Option<u32>,
}
#[derive(Debug, Default, Serialize, Clone)]
struct DeltaPayload<'a> {
  text: &'a str,
}

#[derive(Debug, Default, Serialize, Clone)]
struct DonePayload<'a> {
  finish_reason: &'a str,
}

#[derive(Debug, Default, Serialize, Clone)]
struct ErrorPayload<'a> {
  message: &'a str,
}

pub type AbortMap = Mutex<HashMap<String, JoinHandle<()>>>;

fn strip_v1(url: &str) -> String {
  let s = url.trim_end_matches('/');
  s.strip_suffix("/v1").unwrap_or(s).to_string()
}

fn resolve_base(kind: &str, base_url: &Option<String>) -> String {
  let raw = base_url
    .as_deref()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty());
  match (kind, raw) {
    (_, Some(u)) => strip_v1(&u),
    ("openai", None) => "https://api.openai.com".to_string(),
    ("anthropic", None) => "https://api.anthropic.com".to_string(),
    ("ollama", None) => "http://localhost:11434".to_string(),
    ("gemini", None) => "https://generativelanguage.googleapis.com".to_string(),
    _ => String::new(),
  }
}

fn emit_delta(app: &AppHandle, id: &str, text: &str) {
  let _ = app.emit(&format!("chat:{}:delta", id), DeltaPayload { text });
}

fn emit_done(app: &AppHandle, id: &str, finish_reason: &str) {
  let _ = app.emit(
    &format!("chat:{}:done", id),
    DonePayload { finish_reason },
  );
}

fn emit_error(app: &AppHandle, id: &str, message: &str) {
  let _ = app.emit(
    &format!("chat:{}:error", id),
    ErrorPayload { message },
  );
}

/// OpenAI + OpenAI-compatible: `{base}/v1/chat/completions` with SSE.
async fn stream_openai(
  app: AppHandle,
  request_id: String,
  provider: ChatProvider,
  model: String,
  messages: Vec<ChatMessage>,
  temperature: Option<f32>,
  max_tokens: Option<u32>,
) -> Result<(), String> {
  let base = resolve_base(&provider.kind, &provider.base_url);
  let url = format!("{}/v1/chat/completions", base);

  let mut body = serde_json::json!({
    "model": model,
    "messages": messages.iter().map(|m| serde_json::json!({
      "role": m.role,
      "content": m.content
    })).collect::<Vec<_>>(),
    "stream": true,
  });
  if let Some(t) = temperature {
    body["temperature"] = serde_json::json!(t);
  }
  if let Some(mt) = max_tokens {
    body["max_tokens"] = serde_json::json!(mt);
  }

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(120))
    .build()
    .map_err(|e| e.to_string())?;

  let mut req = client.post(&url).json(&body);
  if let Some(key) = provider.api_key.as_deref().filter(|s| !s.is_empty()) {
    req = req.header("Authorization", format!("Bearer {}", key));
  }

  let resp = req.send().await.map_err(|e| e.to_string())?;
  if !resp.status().is_success() {
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    return Err(format!("HTTP {}: {}", status, text));
  }

  let mut stream = resp.bytes_stream();
  let mut buf = String::new();

  while let Some(item) = stream.next().await {
    let chunk = item.map_err(|e| e.to_string())?;
    let s = String::from_utf8_lossy(&chunk);
    buf.push_str(&s);

    // SSE: 事件用 \n\n 分隔; 每行以 "data: " 开头
    while let Some(pos) = buf.find("\n\n") {
      let event = buf[..pos].to_string();
      buf.drain(..pos + 2);

      for line in event.lines() {
        let line = line.trim();
        if let Some(data) = line.strip_prefix("data:") {
          let data = data.trim();
          if data == "[DONE]" {
            emit_done(&app, &request_id, "stop");
            return Ok(());
          }
          if data.is_empty() {
            continue;
          }
          match serde_json::from_str::<serde_json::Value>(data) {
            Ok(json) => {
              let delta_text = json
                .get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("delta"))
                .and_then(|d| d.get("content"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
              if !delta_text.is_empty() {
                emit_delta(&app, &request_id, delta_text);
              }
              let finish = json
                .get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("finish_reason"))
                .and_then(|v| v.as_str());
              if let Some(reason) = finish {
                emit_done(&app, &request_id, reason);
                return Ok(());
              }
            }
            Err(_) => {
              // 忽略非 JSON 行 (comment / keep-alive)
            }
          }
        }
      }
    }
  }

  emit_done(&app, &request_id, "stop");
  Ok(())
}

/// Anthropic: `{base}/v1/messages` with SSE.
async fn stream_anthropic(
  app: AppHandle,
  request_id: String,
  provider: ChatProvider,
  model: String,
  messages: Vec<ChatMessage>,
  temperature: Option<f32>,
  max_tokens: Option<u32>,
) -> Result<(), String> {
  let base = resolve_base(&provider.kind, &provider.base_url);
  let url = format!("{}/v1/messages", base);
  let api_key = provider
    .api_key
    .as_deref()
    .filter(|s| !s.is_empty())
    .ok_or_else(|| "Anthropic 需要 API Key".to_string())?;

  // Anthropic 需要 system 独立字段
  let mut system_prompt: Option<String> = None;
  let anthropic_messages: Vec<serde_json::Value> = messages
    .iter()
    .filter_map(|m| {
      if m.role == "system" {
        if system_prompt.is_none() {
          system_prompt = Some(m.content.clone());
        }
        None
      } else {
        Some(serde_json::json!({
          "role": m.role,
          "content": m.content,
        }))
      }
    })
    .collect();

  let mut body = serde_json::json!({
    "model": model,
    "messages": anthropic_messages,
    "max_tokens": max_tokens.unwrap_or(4096),
    "stream": true,
  });
  if let Some(sp) = system_prompt {
    body["system"] = serde_json::json!(sp);
  }
  if let Some(t) = temperature {
    body["temperature"] = serde_json::json!(t);
  }

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(120))
    .build()
    .map_err(|e| e.to_string())?;

  let resp = client
    .post(&url)
    .header("x-api-key", api_key)
    .header("anthropic-version", "2023-06-01")
    .json(&body)
    .send()
    .await
    .map_err(|e| e.to_string())?;
  if !resp.status().is_success() {
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    return Err(format!("HTTP {}: {}", status, text));
  }

  let mut stream = resp.bytes_stream();
  let mut buf = String::new();

  while let Some(item) = stream.next().await {
    let chunk = item.map_err(|e| e.to_string())?;
    let s = String::from_utf8_lossy(&chunk);
    buf.push_str(&s);

    while let Some(pos) = buf.find("\n\n") {
      let event = buf[..pos].to_string();
      buf.drain(..pos + 2);
      let mut event_name: Option<String> = None;
      let mut data_line: Option<String> = None;
      for line in event.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("event:") {
          event_name = Some(rest.trim().to_string());
        } else if let Some(rest) = line.strip_prefix("data:") {
          data_line = Some(rest.trim().to_string());
        }
      }
      let (Some(name), Some(data)) = (event_name, data_line) else {
        continue;
      };
      if data.is_empty() {
        continue;
      }
      match serde_json::from_str::<serde_json::Value>(&data) {
        Ok(json) => match name.as_str() {
          "content_block_delta" => {
            let text = json
              .get("delta")
              .and_then(|d| d.get("text"))
              .and_then(|v| v.as_str())
              .unwrap_or("");
            if !text.is_empty() {
              emit_delta(&app, &request_id, text);
            }
          }
          "message_stop" => {
            emit_done(&app, &request_id, "stop");
            return Ok(());
          }
          "message_delta" => {
            let stop_reason = json
              .get("delta")
              .and_then(|d| d.get("stop_reason"))
              .and_then(|v| v.as_str());
            if let Some(r) = stop_reason {
              emit_done(&app, &request_id, r);
              return Ok(());
            }
          }
          _ => {}
        },
        Err(_) => {}
      }
    }
  }

  emit_done(&app, &request_id, "stop");
  Ok(())
}

/// Ollama: `{base}/api/chat` returns NDJSON stream.
async fn stream_ollama(
  app: AppHandle,
  request_id: String,
  provider: ChatProvider,
  model: String,
  messages: Vec<ChatMessage>,
  temperature: Option<f32>,
) -> Result<(), String> {
  let base = resolve_base(&provider.kind, &provider.base_url);
  let url = format!("{}/api/chat", base);

  let mut body = serde_json::json!({
    "model": model,
    "messages": messages.iter().map(|m| serde_json::json!({
      "role": m.role,
      "content": m.content
    })).collect::<Vec<_>>(),
    "stream": true,
  });
  if let Some(t) = temperature {
    body["options"] = serde_json::json!({ "temperature": t });
  }

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(120))
    .build()
    .map_err(|e| e.to_string())?;

  let resp = client
    .post(&url)
    .json(&body)
    .send()
    .await
    .map_err(|e| e.to_string())?;
  if !resp.status().is_success() {
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    return Err(format!("HTTP {}: {}", status, text));
  }

  let mut stream = resp.bytes_stream();
  let mut buf = String::new();

  while let Some(item) = stream.next().await {
    let chunk = item.map_err(|e| e.to_string())?;
    buf.push_str(&String::from_utf8_lossy(&chunk));
    while let Some(pos) = buf.find('\n') {
      let line = buf[..pos].to_string();
      buf.drain(..pos + 1);
      let line = line.trim();
      if line.is_empty() {
        continue;
      }
      match serde_json::from_str::<serde_json::Value>(line) {
        Ok(json) => {
          let text = json
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
          if !text.is_empty() {
            emit_delta(&app, &request_id, text);
          }
          if json.get("done").and_then(|v| v.as_bool()).unwrap_or(false) {
            emit_done(&app, &request_id, "stop");
            return Ok(());
          }
        }
        Err(_) => {}
      }
    }
  }

  emit_done(&app, &request_id, "stop");
  Ok(())
}

/// Gemini: `{base}/v1beta/models/{model}:streamGenerateContent?alt=sse&key={apiKey}`.
async fn stream_gemini(
  app: AppHandle,
  request_id: String,
  provider: ChatProvider,
  model: String,
  messages: Vec<ChatMessage>,
  temperature: Option<f32>,
) -> Result<(), String> {
  let base = resolve_base(&provider.kind, &provider.base_url);
  let api_key = provider
    .api_key
    .as_deref()
    .filter(|s| !s.is_empty())
    .ok_or_else(|| "Gemini 需要 API Key".to_string())?;

  let url = format!(
    "{}/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
    base,
    model,
    urlencoding::encode(api_key)
  );

  // Gemini contents 结构: [{role: "user"|"model", parts: [{text}]}]
  let mut system_instruction: Option<String> = None;
  let contents: Vec<serde_json::Value> = messages
    .iter()
    .filter_map(|m| match m.role.as_str() {
      "system" => {
        if system_instruction.is_none() {
          system_instruction = Some(m.content.clone());
        }
        None
      }
      "assistant" => Some(serde_json::json!({
        "role": "model",
        "parts": [{ "text": m.content }],
      })),
      _ => Some(serde_json::json!({
        "role": "user",
        "parts": [{ "text": m.content }],
      })),
    })
    .collect();

  let mut body = serde_json::json!({ "contents": contents });
  if let Some(t) = temperature {
    body["generationConfig"] = serde_json::json!({ "temperature": t });
  }
  if let Some(sp) = system_instruction {
    body["systemInstruction"] = serde_json::json!({
      "parts": [{ "text": sp }]
    });
  }

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(120))
    .build()
    .map_err(|e| e.to_string())?;

  let resp = client
    .post(&url)
    .json(&body)
    .send()
    .await
    .map_err(|e| e.to_string())?;
  if !resp.status().is_success() {
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    return Err(format!("HTTP {}: {}", status, text));
  }

  let mut stream = resp.bytes_stream();
  let mut buf = String::new();

  while let Some(item) = stream.next().await {
    let chunk = item.map_err(|e| e.to_string())?;
    buf.push_str(&String::from_utf8_lossy(&chunk));

    while let Some(pos) = buf.find("\n\n") {
      let event = buf[..pos].to_string();
      buf.drain(..pos + 2);

      for line in event.lines() {
        if let Some(data) = line.trim().strip_prefix("data:") {
          let data = data.trim();
          if data.is_empty() {
            continue;
          }
          match serde_json::from_str::<serde_json::Value>(data) {
            Ok(json) => {
              let text = json
                .get("candidates")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("content"))
                .and_then(|c| c.get("parts"))
                .and_then(|p| p.get(0))
                .and_then(|p| p.get("text"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
              if !text.is_empty() {
                emit_delta(&app, &request_id, text);
              }
              let finish = json
                .get("candidates")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("finishReason"))
                .and_then(|v| v.as_str());
              if let Some(reason) = finish {
                emit_done(&app, &request_id, reason);
                return Ok(());
              }
            }
            Err(_) => {}
          }
        }
      }
    }
  }

  emit_done(&app, &request_id, "stop");
  Ok(())
}

#[tauri::command]
pub async fn chat_stream(
  app: AppHandle,
  abort_map: State<'_, AbortMap>,
  req: ChatRequest,
) -> Result<(), String> {
  let request_id = req.request_id.clone();
  let app_clone = app.clone();
  let id_for_task = request_id.clone();

  // 已经在跑的 id: 先取消旧任务
  if let Ok(mut map) = abort_map.lock() {
    if let Some(handle) = map.remove(&request_id) {
      handle.abort();
    }
  }

  let handle = tokio::spawn(async move {
    let result = match req.provider.kind.as_str() {
      "openai" | "openai-compatible" => {
        stream_openai(
          app_clone.clone(),
          id_for_task.clone(),
          req.provider,
          req.model,
          req.messages,
          req.temperature,
          req.max_tokens,
        )
        .await
      }
      "anthropic" => {
        stream_anthropic(
          app_clone.clone(),
          id_for_task.clone(),
          req.provider,
          req.model,
          req.messages,
          req.temperature,
          req.max_tokens,
        )
        .await
      }
      "ollama" => {
        stream_ollama(
          app_clone.clone(),
          id_for_task.clone(),
          req.provider,
          req.model,
          req.messages,
          req.temperature,
        )
        .await
      }
      "gemini" => {
        stream_gemini(
          app_clone.clone(),
          id_for_task.clone(),
          req.provider,
          req.model,
          req.messages,
          req.temperature,
        )
        .await
      }
      other => Err(format!("不支持的 provider kind: {}", other)),
    };
    if let Err(msg) = result {
      emit_error(&app_clone, &id_for_task, &msg);
    }
  });

  if let Ok(mut map) = abort_map.lock() {
    map.insert(request_id, handle);
  }

  Ok(())
}

#[tauri::command]
pub async fn chat_stream_abort(
  abort_map: State<'_, AbortMap>,
  request_id: String,
) -> Result<(), String> {
  if let Ok(mut map) = abort_map.lock() {
    if let Some(handle) = map.remove(&request_id) {
      handle.abort();
    }
  }
  Ok(())
}
