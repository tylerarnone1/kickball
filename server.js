const express = require("express");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "kickball";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

let db;
const str = (v, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const dateOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const safeEq = (a, b) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};
const admin = (req, res, next) =>
  safeEq(req.get("x-admin-password") || "", ADMIN_PASSWORD) ? next() : res.status(401).json({ error: "Unauthorized" });
const oid = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: "Server error" }); });

// Public
app.get("/api/news", wrap(async (_req, res) => {
  res.json(await db.collection("news").find().sort({ date: -1, _id: -1 }).toArray());
}));
app.get("/api/events", wrap(async (_req, res) => {
  res.json(await db.collection("events").find().sort({ date: 1 }).toArray());
}));

const TYPES = ["game", "practice", "social"];
app.post("/api/signups", wrap(async (req, res) => {
  const b = req.body || {};
  const doc = {
    firstName: str(b.firstName, 80), lastName: str(b.lastName, 80), email: str(b.email, 200),
    phone: str(b.phone, 30), age: parseInt(b.age, 10), shirt: str(b.shirt, 5),
    regType: b.regType === "team" ? "team" : "individual", team: str(b.team, 100),
    experience: str(b.experience, 30), notes: str(b.notes, 1000),
    waiver: b.waiver === true || b.waiver === "agreed", createdAt: new Date(),
  };
  if (!doc.firstName || !doc.lastName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(doc.email) ||
      !(doc.age >= 18 && doc.age <= 99) || !doc.shirt || !doc.waiver)
    return res.status(400).json({ error: "Please complete all required fields (18+ and waiver)." });
  if (await db.collection("signups").findOne({ email: doc.email.toLowerCase() }))
    return res.status(409).json({ error: "That email is already registered." });
  doc.email = doc.email.toLowerCase();
  await db.collection("signups").insertOne(doc);
  res.status(201).json({ ok: true });
}));

// Admin
app.get("/api/admin/check", admin, (_req, res) => res.json({ ok: true }));
app.get("/api/admin/signups", admin, wrap(async (_req, res) => {
  res.json(await db.collection("signups").find().sort({ createdAt: -1 }).toArray());
}));
app.delete("/api/admin/signups/:id", admin, wrap(async (req, res) => {
  const id = oid(req.params.id); if (!id) return res.status(400).json({ error: "Bad id" });
  await db.collection("signups").deleteOne({ _id: id }); res.json({ ok: true });
}));

app.post("/api/admin/news", admin, wrap(async (req, res) => {
  const doc = { title: str(req.body.title, 150), body: str(req.body.body, 3000), date: str(req.body.date, 10) };
  if (!doc.title || !doc.body || !dateOk(doc.date)) return res.status(400).json({ error: "Title, body and date required." });
  await db.collection("news").insertOne(doc); res.status(201).json({ ok: true });
}));
app.post("/api/admin/events", admin, wrap(async (req, res) => {
  const b = req.body;
  const doc = { title: str(b.title, 150), date: str(b.date, 10), time: str(b.time, 30), type: b.type,
    location: str(b.location, 150), details: str(b.details, 1000) };
  if (!doc.title || !dateOk(doc.date) || !TYPES.includes(doc.type)) return res.status(400).json({ error: "Title, date and valid type required." });
  await db.collection("events").insertOne(doc); res.status(201).json({ ok: true });
}));
for (const c of ["news", "events"]) {
  app.delete(`/api/admin/${c}/:id`, admin, wrap(async (req, res) => {
    const id = oid(req.params.id); if (!id) return res.status(400).json({ error: "Bad id" });
    await db.collection(c).deleteOne({ _id: id }); res.json({ ok: true });
  }));
}

MongoClient.connect(MONGO_URL).then(async (client) => {
  db = client.db(DB_NAME);
  await db.collection("signups").createIndex({ email: 1 }, { unique: true });
  if (ADMIN_PASSWORD === "changeme") console.warn("WARNING: set ADMIN_PASSWORD env var; using default 'changeme'.");
  app.listen(PORT, () => console.log(`Kickball site on http://localhost:${PORT}`));
}).catch((e) => { console.error("Mongo connection failed:", e.message); process.exit(1); });
