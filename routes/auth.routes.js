const express = require("express");
const bcrypt = require("bcrypt");
const { getDb } = require("../database/mongo");

const router = express.Router();

const USERS_COL = "users";

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  safe._id = String(user._id);
  return safe;
}

// (Опционально) регистрация — можно оставить, но на защите не обязательно показывать
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 chars" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 chars" });
    }

    const db = getDb();
    const col = db.collection(USERS_COL);

    const existing = await col.findOne({ username: username.trim().toLowerCase() });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const doc = {
      username: username.trim().toLowerCase(),
      passwordHash,
      createdAt: new Date(),
    };

    const result = await col.insertOne(doc);
    const created = await col.findOne({ _id: result.insertedId });

    return res.status(201).json({ user: sanitizeUser(created) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    // ✅ generic message requirement
    const invalid = () => res.status(401).json({ error: "Invalid credentials" });

    if (!username || !password) return invalid();

    const db = getDb();
    const col = db.collection(USERS_COL);

    const user = await col.findOne({ username: String(username).trim().toLowerCase() });
    if (!user) return invalid();

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return invalid();

    // ✅ session created
    req.session.userId = String(user._id);
    req.session.username = user.username; // не чувствительные данные

    return res.status(200).json({ ok: true, user: sanitizeUser(user) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/logout", async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    return res.status(200).json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (!req.session.userId) return res.status(200).json({ user: null });
  return res.status(200).json({
    user: { id: req.session.userId, username: req.session.username },
  });
});

module.exports = router;
