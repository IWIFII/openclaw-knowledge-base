const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;
const SITE_DIR = __dirname;
const MEMBERS_PATH = path.join(SITE_DIR, "members.full.json");

const LOGIN_USER = process.env.SITE_USER;
const LOGIN_PASS = process.env.SITE_PASS;

const sessions = new Map();
const askRate = new Map();
const chatHistory = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ASK_LIMIT_PER_MIN = 10;
const CHAT_MAX_TURNS = 10;

function readMembers() {
  const raw = fs.readFileSync(MEMBERS_PATH, "utf-8");
  return JSON.parse(raw);
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function isAuthed(req) {
  const token = getToken(req);
  if (!token || !sessions.has(token)) return false;
  const createdAt = sessions.get(token);
  if (Date.now() - createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function checkAskRate(token) {
  const now = Date.now();
  const arr = askRate.get(token) || [];
  const recent = arr.filter((ts) => now - ts < 60_000);
  if (recent.length >= ASK_LIMIT_PER_MIN) return false;
  recent.push(now);
  askRate.set(token, recent);
  return true;
}

function getProviderConfig() {
  const cfgPath = "/root/.openclaw/openclaw.json";
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
    const p = cfg?.models?.providers?.rayincode;
    if (!p) return null;
    return {
      baseUrl: process.env.RAYINCODE_BASE_URL || p.baseUrl,
      apiKey: process.env.RAYINCODE_API_KEY || p.apiKey,
      model: process.env.RAYINCODE_MODEL || "gpt-5.3-codex",
    };
  } catch {
    return null;
  }
}

async function askModel(message, history = []) {
  const provider = getProviderConfig();
  if (!provider?.baseUrl || !provider?.apiKey) {
    throw new Error("model_provider_not_configured");
  }

  const url = provider.baseUrl.replace(/\/$/, "") + "/responses";
  const payload = {
    model: provider.model,
    max_output_tokens: 700,
    input: [
      {
        role: "system",
        content:
          "你是创新π协会网站内的助手。回答简洁、准确、中文优先；优先结合本对话上下文连续回答。涉及成员隐私时仅基于已授权可见数据回答。",
      },
      ...history,
      { role: "user", content: message },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`model_http_${resp.status}:${txt.slice(0, 200)}`);
  }

  const data = await resp.json();
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const c of item.content || []) {
      if (c.type === "output_text" && c.text) chunks.push(c.text);
      if (c.type === "text" && c.text) chunks.push(c.text);
    }
  }
  const text = chunks.join("\n").trim();
  return text || "我暂时没有可返回的内容，请再试一次。";
}

app.use(express.json({ limit: "200kb" }));
app.use(express.static(SITE_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== LOGIN_USER || password !== LOGIN_PASS) {
    return res.status(401).json({ ok: false, error: "invalid_credentials" });
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now());
  res.json({ ok: true, token });
});

app.get("/api/members", (_req, res) => {
  const full = readMembers();
  const partial = full.map((m) => ({
    name: m.name,
    className: m.className,
    major: m.major,
    gender: m.gender,
  }));
  res.json({ ok: true, members: partial });
});

app.get("/api/members/full", (req, res) => {
  if (!isAuthed(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  res.json({ ok: true, members: readMembers() });
});

app.post("/api/ask", async (req, res) => {
  if (!isAuthed(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  const token = getToken(req);
  if (!checkAskRate(token)) {
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }

  const msg = String((req.body || {}).message || "").trim();
  if (!msg) return res.status(400).json({ ok: false, error: "empty_message" });
  if (msg.length > 2000) return res.status(400).json({ ok: false, error: "message_too_long" });

  const history = chatHistory.get(token) || [];

  try {
    const answer = await askModel(msg, history);
    const next = [
      ...history,
      { role: "user", content: msg },
      { role: "assistant", content: answer },
    ].slice(-CHAT_MAX_TURNS * 2);
    chatHistory.set(token, next);
    res.json({ ok: true, answer });
  } catch (err) {
    res.status(500).json({ ok: false, error: "ask_failed", detail: String(err.message || err) });
  }
});

if (!LOGIN_USER || !LOGIN_PASS) {
  console.error("Missing SITE_USER or SITE_PASS environment variables.");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`site backend listening on :${PORT}`);
});
