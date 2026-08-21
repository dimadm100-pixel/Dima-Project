// Anthropic Messages API client.
//
// This app has no build step and no bundler, so the official SDK isn't an
// option here -- we talk to the REST endpoint directly with fetch. Calling the
// API from a browser requires the explicit opt-in header below; the key lives
// only in this device's localStorage and is never committed or sent anywhere
// except api.anthropic.com.

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const KEY_STORAGE = "pft_anthropic_key";
const MODEL_STORAGE = "pft_anthropic_model";

export const MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5", note: "Most capable. Best judgement on your finances." },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Cheaper, still strong." },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "Cheapest and fastest. Fine for summaries." }
];

export const DEFAULT_MODEL = "claude-opus-5";

export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE) || "";
}
export function setApiKey(key) {
  if (key) localStorage.setItem(KEY_STORAGE, key.trim());
  else localStorage.removeItem(KEY_STORAGE);
}
export function hasApiKey() {
  return !!getApiKey();
}
export function getModel() {
  return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL;
}
export function setModel(id) {
  localStorage.setItem(MODEL_STORAGE, id);
}

function headers() {
  return {
    "content-type": "application/json",
    "x-api-key": getApiKey(),
    "anthropic-version": API_VERSION,
    "anthropic-dangerous-direct-browser-access": "true"
  };
}

class AIError extends Error {
  constructor(message, { status, kind } = {}) {
    super(message);
    this.name = "AIError";
    this.status = status;
    this.kind = kind;
  }
}

function describeFailure(status, body) {
  const apiMessage = body?.error?.message;
  switch (status) {
    case 401:
    case 403:
      return new AIError("That API key was rejected. Check it in Settings — it should start with 'sk-ant-'.", { status, kind: "auth" });
    case 400:
      return new AIError(apiMessage || "The request was rejected as invalid.", { status, kind: "request" });
    case 404:
      return new AIError("That model isn't available on your account. Try a different one in Settings.", { status, kind: "model" });
    case 429:
      return new AIError("Rate limited — too many requests. Wait a moment and try again.", { status, kind: "rate_limit" });
    case 529:
      return new AIError("Anthropic's API is overloaded right now. Try again shortly.", { status, kind: "overloaded" });
    default:
      if (status >= 500) return new AIError("Anthropic's API had a server error. Try again shortly.", { status, kind: "server" });
      return new AIError(apiMessage || `Request failed (HTTP ${status}).`, { status, kind: "unknown" });
  }
}

async function parseFailure(res) {
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error body */ }
  return describeFailure(res.status, body);
}

function assertKey() {
  if (!hasApiKey()) {
    throw new AIError("No API key set. Add one in Settings to turn on the AI features.", { kind: "no_key" });
  }
}

function baseBody(extra) {
  return {
    model: getModel(),
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    ...extra
  };
}

/**
 * One-shot request. Returns the full response object.
 */
export async function complete({ system, messages, tools, toolChoice, maxTokens }) {
  assertKey();
  const body = baseBody({ messages });
  if (system) body.system = system;
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;
  if (maxTokens) body.max_tokens = maxTokens;

  let res;
  try {
    res = await fetch(API_URL, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  } catch (e) {
    throw new AIError("Couldn't reach the API. Check your internet connection.", { kind: "network" });
  }
  if (!res.ok) throw await parseFailure(res);
  return res.json();
}

/**
 * Streaming request. Calls onText with each chunk of visible text as it arrives.
 * Returns the assembled text once the stream finishes.
 */
export async function stream({ system, messages, maxTokens, onText }) {
  assertKey();
  const body = baseBody({ messages, stream: true, max_tokens: maxTokens || 64000 });
  if (system) body.system = system;

  let res;
  try {
    res = await fetch(API_URL, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  } catch (e) {
    throw new AIError("Couldn't reach the API. Check your internet connection.", { kind: "network" });
  }
  if (!res.ok) throw await parseFailure(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; keep any trailing partial frame.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let evt;
        try { evt = JSON.parse(payload); } catch { continue; }

        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          full += evt.delta.text;
          if (onText) onText(evt.delta.text, full);
        } else if (evt.type === "error") {
          throw new AIError(evt.error?.message || "The stream failed.", { kind: "stream" });
        }
      }
    }
  }
  return full;
}

export function textOf(response) {
  return (response.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export function toolUsesOf(response) {
  return (response.content || []).filter((b) => b.type === "tool_use");
}

export { AIError };
