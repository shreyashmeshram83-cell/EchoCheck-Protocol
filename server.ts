import express from "express";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import { MongoClient, Db } from "mongodb";

const app = express();
const PORT = 3000;
const SECRET = process.env.ECHOCHECK_SECRET || "default-secret-key";
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json());

let db: Db | null = null;

// Lazy MongoDB Connection
async function getDb() {
  if (db) return db;
  if (!MONGODB_URI) {
    console.warn("MONGODB_URI not found. Falling back to in-memory mode for nonces.");
    return null;
  }
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    db = client.db();
    
    // Create index for nonces (expire after 10 minutes)
    await db.collection("nonces").createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 });
    // Create index for siteKey lookups
    await db.collection("verifications").createIndex({ siteKey: 1, timestamp: -1 });
    
    console.log("Connected to MongoDB successfully.");
    return db;
  } catch (e) {
    console.error("MongoDB connection failed:", e);
    return null;
  }
}

// Mock database for nonces 
const usedNoncesMemory = new Set<string>();

// API: Verify the biometric score and site key
app.post("/api/verify", async (req, res) => {
  const { score, nonce, siteKey, timestamp } = req.body;

  if (!score || !nonce || !siteKey) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const database = await getDb();

  // 1. Check nonce (replay protection)
  if (database) {
    const existingNonce = await database.collection("nonces").findOne({ nonce });
    if (existingNonce) {
      return res.status(403).json({ error: "Nonce already used" });
    }
    await database.collection("nonces").insertOne({ nonce, createdAt: new Date() });
  } else {
    if (usedNoncesMemory.has(nonce)) {
      return res.status(403).json({ error: "Nonce already used" });
    }
    usedNoncesMemory.add(nonce);
    setTimeout(() => usedNoncesMemory.delete(nonce), 300000);
  }

  // 2. Server-side threshold verification
  const THRESHOLD = 0.65;
  const isHuman = score > THRESHOLD;

  // Log verification attempt to MongoDB
  if (database) {
    await database.collection("verifications").insertOne({
      siteKey,
      score,
      isHuman,
      timestamp: new Date(timestamp || Date.now()),
      nonce
    });
  }

  if (!isHuman) {
    return res.json({ success: false, error: "Bot detected" });
  }

  // 3. Generate HMAC-signed JWT token
  const token = jwt.sign(
    {
      siteKey,
      isHuman: true,
      score,
      iat: Math.floor(Date.now() / 1000),
    },
    SECRET,
    { expiresIn: "10m" }
  );

  res.json({ success: true, token });
});

// Serve the widget and model files
app.use("/cdn", express.static(path.resolve("public")));

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve("dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EchoCheck Server running on http://localhost:${PORT}`);
  });
}

startServer();
