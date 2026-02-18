const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;
const SITE_DIR = __dirname;
const MEMBERS_PATH = path.join(SITE_DIR, "members.full.json");

const LOGIN_USER = process.env.SITE_USER || "admin";
const LOGIN_PASS = process.env.SITE_PASS || "pi2026";

const sessions = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

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

app.use(express.json());
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

app.listen(PORT, () => {
  console.log(`site backend listening on :${PORT}`);
});
