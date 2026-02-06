require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const { connectToMongo, closeMongo } = require("./database/mongo");
const itemsRoutes = require("./routes/items.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();

app.set("trust proxy", 1);

// middleware
app.use(express.json());

// logger
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// ✅ Validate required env
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "assn3db";
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing in environment variables");
  process.exit(1);
}
if (!SESSION_SECRET) {
  console.error("❌ SESSION_SECRET is missing in environment variables");
  process.exit(1);
}

// ✅ Sessions (cookie-based)
app.use(
  session({
    name: "sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      dbName: DB_NAME,
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 7, // 7 days
    }),
    cookie: {
      httpOnly: true, // ✅ required
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // ✅ recommended in prod (HTTPS)
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// ✅ Frontend from /public (root URL "/")
app.use(express.static(path.join(__dirname, "public")));

// ✅ Auth API
app.use("/api/auth", authRoutes);

// ✅ Main API
app.use("/api/items", itemsRoutes);

// health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// API 404
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// non-api 404
app.use((_req, res) => {
  res.status(404).send("Not Found");
});

async function start() {
  await connectToMongo({ uri: MONGO_URI, dbName: DB_NAME });

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 UI:  http://localhost:${PORT}/`);
    console.log(`🔌 API: http://localhost:${PORT}/api/items`);
  });
}

start().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  try {
    await closeMongo();
  } finally {
    process.exit(0);
  }
});
