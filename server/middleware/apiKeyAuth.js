const crypto = require("crypto");
const ApiKey = require("../models/ApiKey");
const User = require("../models/User");
const { getWorkspaceMembership } = require("../services/workspaceAccess");

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;
const requestWindows = new Map();

function fail(res, status, message, code) {
  return res.status(status).json({ success: false, data: null, error: { code, message } });
}

function allowRate(requestId, now) {
  let window = requestWindows.get(requestId);
  if (!window || now - window.startedAt >= WINDOW_MS) {
    window = { startedAt: now, count: 0 };
    requestWindows.set(requestId, window);
  }
  window.count += 1;
  if (requestWindows.size > 10000) {
    for (const [id, item] of requestWindows) {
      if (now - item.startedAt >= WINDOW_MS) requestWindows.delete(id);
    }
  }
  return window.count <= MAX_REQUESTS_PER_WINDOW;
}

async function apiKeyAuth(req, res, next) {
  try {
    const authorization = req.get("Authorization") || "";
    const match = /^Bearer\s+(sb_live_[a-f0-9]{64})$/i.exec(authorization);
    if (!match) return fail(res, 401, "Provide a valid API key using the Bearer authorization scheme.", "UNAUTHENTICATED");

    const rawKey = match[1];
    const prefix = rawKey.slice(0, 24);
    const apiKey = await ApiKey.findOne({ keyPrefix: prefix, revokedAt: null })
      .select("+keyPrefix +keyHash");
    const suppliedHash = crypto.createHash("sha256").update(rawKey).digest();
    const storedHash = apiKey ? Buffer.from(apiKey.keyHash, "hex") : Buffer.alloc(0);
    if (!apiKey || storedHash.length !== suppliedHash.length || !crypto.timingSafeEqual(storedHash, suppliedHash)) {
      return fail(res, 401, "API key is invalid or revoked.", "UNAUTHENTICATED");
    }

    const [userExists, membership] = await Promise.all([
      User.exists({ _id: apiKey.user }),
      getWorkspaceMembership(apiKey.workspace, apiKey.user)
    ]);
    if (!userExists || !membership) {
      return fail(res, 403, "The API key owner no longer has access to this workspace.", "FORBIDDEN");
    }
    if (!allowRate(apiKey._id.toString(), Date.now())) {
      res.set("Retry-After", "60");
      return fail(res, 429, "API key request limit exceeded. Try again in one minute.", "RATE_LIMITED");
    }

    const now = new Date();
    await ApiKey.updateOne(
      { _id: apiKey._id, revokedAt: null },
      { $inc: { requestCount: 1 }, $set: { lastUsedAt: now } }
    );
    req.apiKey = {
      id: apiKey._id,
      userId: apiKey.user,
      workspaceId: apiKey.workspace,
      scopes: apiKey.scopes
    };
    return next();
  } catch (error) {
    console.error("API key authentication failed", error.message);
    return fail(res, 500, "Unable to authenticate this API request.", "INTERNAL_ERROR");
  }
}

function requireScope(scope) {
  return (req, res, next) => {
    if (!req.apiKey.scopes.includes(scope)) {
      return fail(res, 403, `This API key requires the ${scope} scope.`, "INSUFFICIENT_SCOPE");
    }
    return next();
  };
}

module.exports = { apiKeyAuth, requireScope };
