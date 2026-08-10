const mongoose = require("mongoose");
let mongoMemoryServer = null;

const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27017/survey-builder";

async function startInMemoryServer() {
  try {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongoMemoryServer = await MongoMemoryServer.create();
    const memUri = mongoMemoryServer.getUri();
    await mongoose.connect(memUri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB connected (in-memory fallback)");
    return true;
  } catch (err) {
    console.error("In-memory MongoDB start error:", err.message);
    return false;
  }
}

async function connectDB() {
  const uri = process.env.MONGO_URI;

  // Helper to try a URI and return true/false
  async function tryConnect(targetUri) {
    try {
      await mongoose.connect(targetUri, { serverSelectionTimeoutMS: 5000 });
      console.log(`MongoDB connected (${targetUri.includes("127.0.0.1") ? "local" : "configured"})`);
      return true;
    } catch (err) {
      console.error(`MongoDB connection error (${targetUri}):`, err.message);
      return false;
    }
  }

  if (uri) {
    const ok = await tryConnect(uri);
    if (ok) return;
    // If SRV/Atlas failed, try local then in-memory
    if (String(uri).startsWith("mongodb+srv")) {
      console.warn("SRV/Atlas connection failed — trying local MongoDB fallback...");
      const localOk = await tryConnect(DEFAULT_LOCAL_URI);
      if (localOk) return;
      const memOk = await startInMemoryServer();
      if (memOk) return;
    }
    console.error("Please verify `MONGO_URI` and network access (for Atlas, whitelist your IP or enable access).");
    process.exit(1);
  }

  // No URI provided: try local, then in-memory
  console.warn("MONGO_URI is not set in server/.env — attempting local MongoDB...");
  const localOk = await tryConnect(DEFAULT_LOCAL_URI);
  if (localOk) return;

  const memOk = await startInMemoryServer();
  if (memOk) return;

  console.error("Could not connect to any MongoDB instance. Install MongoDB, run via Docker, or set MONGO_URI.");
  process.exit(1);
}

// Stop in-memory server on exit
process.on("exit", async () => {
  if (mongoMemoryServer) {
    try {
      await mongoMemoryServer.stop();
    } catch (e) {}
  }
});

module.exports = connectDB;
