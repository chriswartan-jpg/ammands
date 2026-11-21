// centrix demo server: serves website/ and proxies the AI integrations.
//
// The browser never sees an API key. It calls /api/* on this server, and the
// server calls OpenAI (understanding and conversation) and ElevenLabs (voice in,
// voice out) with the keys from the git-ignored .env file in the repo root.
//
//   npm start            → http://localhost:8780
//
// Without keys the site still works: the portals fall back to their built-in,
// rule-based assistant.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SITE = join(ROOT, "website");
loadEnv(join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 8780);
const HOST = process.env.HOST || "127.0.0.1";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const ELEVEN_TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
const ELEVEN_STT_MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

// ---------- tiny .env loader (no dependencies) ----------
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ---------- simple per-IP rate limit, so a stray loop can't burn the API budget ----------
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 90;
}

// ---------- OpenAI ----------
async function openai(system, user, schemaName, schema, attempt = 1) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      messages: [{ role: "system", content: system }, ...(Array.isArray(user) ? user : [{ role: "user", content: user }])],
      response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } }
    })
  });
  // OpenAI sometimes returns a short-lived 5xx or 429: try twice more with a small backoff
  if ((res.status >= 500 || res.status === 429) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 400 * attempt));
    return openai(system, user, schemaName, schema, attempt + 1);
  }
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

const obj = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const str = { type: "string" };

const PERSONA = `You are the centrix assistant inside a tenant portal of a German property manager (Aachen).
You help tenants report home problems and follow a plumbing repair until it's closed.
Style: warm, calm, short (1–3 sentences), plain words, no markdown, no emojis, never invent facts about the case.
Always answer in the tenant's language.`;

const TASKS = {
  // Steps 2, 3, 5 and 7: language, classification, follow-up questions and urgency in one call.
  async classify({ text, home }) {
    const schema = obj({
      route: { type: "string", enum: ["plumbing", "not_plumbing", "uncertain"] },
      problem: { type: "string", enum: ["leak", "blockage", "hotwater", "toilet", "none"] },
      language: obj({ code: str, name: str }),
      urgent: { type: "boolean" },
      title: str,
      reply: str,
      followUps: {
        type: "array",
        items: obj({ q: str, options: { type: "array", items: obj({ label: str, urgent: { type: "boolean" } }) } })
      }
    });
    return openai(`${PERSONA}
Task: read the tenant's first report and classify it.
- route: "plumbing" for water, pipes, drains, toilets, taps, water heaters. "not_plumbing" for anything else. "uncertain" if you can't tell.
- problem: the closest of leak, blockage, hotwater, toilet (use "none" when not plumbing).
- language: ISO 639-1 code and English name of the language the tenant wrote in.
- urgent: true only for active water damage, no water/heat for a vulnerable household, or sewage.
- title: a short English title for the plumber's brief, e.g. "Leak under the kitchen sink".
- reply: one short sentence in the tenant's language that shows you understood, without asking a question.
- followUps: for plumbing only, the 3 most useful one-tap questions in the tenant's language, each with 2–3 short answer options. Mark an option urgent:true when choosing it means the problem is urgent. Don't ask for things centrix already knows (address, phone, access).
Known about the home: ${JSON.stringify(home || {})}`, String(text).slice(0, 2000), "classification", schema);
  },

  // Free conversation at any point in the case, grounded in the case state.
  async chat({ messages, context }) {
    const schema = obj({
      reply: str,
      intent: { type: "string", enum: ["none", "rebook", "not_fixed", "urgent"] }
    });
    const history = (Array.isArray(messages) ? messages : []).slice(-14).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 1500)
    }));
    return openai(`${PERSONA}
Task: answer the tenant's latest message using only the case facts below.
- If they ask about cost, time, the plumber, what's shared or what happens next, answer from the facts.
- intent "rebook" when they clearly want a different appointment time; "not_fixed" when they say the repair didn't work; "urgent" when they describe a new emergency (flooding, water through the ceiling); otherwise "none".
- If something isn't in the facts, say you'll pass it on to the plumber or property manager.
Case facts: ${JSON.stringify(context || {})}`, history, "chat_reply", schema);
  },

  // Keep scripted portal messages in the tenant's language.
  async translate({ texts, language }) {
    const list = (Array.isArray(texts) ? texts : []).slice(0, 20).map((t) => String(t).slice(0, 800));
    const schema = obj({ texts: { type: "array", items: str } });
    return openai(`Translate each string into ${String(language).slice(0, 40)}. Keep names, numbers, times, prices, case and job IDs exactly. Return the same number of strings in the same order.`,
      JSON.stringify(list), "translations", schema);
  },

  // Step 11: turn the plumber's dictation into 3 time windows.
  async windows({ text }) {
    const schema = obj({ windows: { type: "array", items: str } });
    return openai(`Extract the time windows a plumber dictated. Return up to 3, formatted like "Tomorrow 10:00–12:00" or "Fri 14:00–16:00" (24-hour clock, en dash). If a window has only a start time, make it 2 hours long. Ignore anything that isn't a time window.`,
      String(text).slice(0, 1000), "windows", schema);
  },

  // Step 17: tidy up a dictated work note.
  async work_note({ text }) {
    const schema = obj({ note: str });
    return openai(`Clean up a plumber's dictated work note: fix punctuation and obvious speech-recognition errors, keep every fact, keep it short, first person, English. Don't add anything that wasn't said.`,
      String(text).slice(0, 2000), "work_note", schema);
  }
};

// ---------- ElevenLabs ----------
async function tts(text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": ELEVEN_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ text: String(text).slice(0, 700), model_id: ELEVEN_TTS_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function stt(audio, type) {
  const form = new FormData();
  form.append("model_id", ELEVEN_STT_MODEL);
  form.append("file", new Blob([audio], { type: type || "audio/webm" }), "speech.webm");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVEN_KEY },
    signal: AbortSignal.timeout(30_000),
    body: form
  });
  if (!res.ok) throw new Error(`ElevenLabs STT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { text: (data.text || "").trim(), language: data.language_code || null };
}

// ---------- HTTP ----------
function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

async function readBody(req, max) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) throw Object.assign(new Error("Too large"), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function api(req, res, path) {
  if (path === "/api/status") {
    return send(res, 200, { openai: Boolean(OPENAI_KEY), elevenlabs: Boolean(ELEVEN_KEY), model: OPENAI_KEY ? OPENAI_MODEL : null });
  }
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  // Only pages served by this server may use the API
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}`) return send(res, 403, { error: "Wrong origin." });
  if (limited(req.socket.remoteAddress)) return send(res, 429, { error: "Too many requests. Wait a minute." });

  try {
    if (path === "/api/assistant") {
      if (!OPENAI_KEY) return send(res, 503, { error: "OpenAI is not configured." });
      const body = JSON.parse((await readBody(req, 200_000)).toString("utf8") || "{}");
      const task = TASKS[body.task];
      if (!task) return send(res, 400, { error: "Unknown task." });
      return send(res, 200, await task(body));
    }
    if (path === "/api/tts") {
      if (!ELEVEN_KEY) return send(res, 503, { error: "ElevenLabs is not configured." });
      const { text } = JSON.parse((await readBody(req, 20_000)).toString("utf8") || "{}");
      if (!text || !String(text).trim()) return send(res, 400, { error: "No text." });
      return send(res, 200, await tts(text), "audio/mpeg");
    }
    if (path === "/api/stt") {
      if (!ELEVEN_KEY) return send(res, 503, { error: "ElevenLabs is not configured." });
      const audio = await readBody(req, 10_000_000);
      if (audio.length < 800) return send(res, 400, { error: "Recording too short." });
      return send(res, 200, await stt(audio, req.headers["content-type"]));
    }
    return send(res, 404, { error: "Not found." });
  } catch (err) {
    console.error(`[${path}]`, err.message);
    return send(res, err.status || 502, { error: err.status === 413 ? "Too large." : "The AI service didn't answer. Try again, or type instead." });
  }
}

async function serveStatic(req, res, path) {
  const file = normalize(join(SITE, decodeURIComponent(path === "/" ? "/index.html" : path)));
  if (!file.startsWith(SITE)) return send(res, 403, "Forbidden", "text/plain");
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(await readFile(file));
  } catch {
    send(res, 404, "Not found", "text/plain");
  }
}

createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path.startsWith("/api/")) return api(req, res, path);
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", "text/plain");
  return serveStatic(req, res, path);
}).listen(PORT, HOST, () => {
  console.log(`centrix running at http://localhost:${PORT}`);
  console.log(`OpenAI: ${OPENAI_KEY ? `on (${OPENAI_MODEL})` : "off"} · ElevenLabs: ${ELEVEN_KEY ? "on" : "off"}`);
});
