const crypto = require("crypto");
const mongoose = require("mongoose");
const ApiKey = require("../models/ApiKey");
const { getWorkspaceMembership } = require("../services/workspaceAccess");

function sendError(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.name === "CastError") return res.status(404).json({ message: "Workspace or API key not found" });
  console.error(fallback, error.message);
  return res.status(500).json({ message: fallback });
}

async function getWorkspaceAccess(workspaceId, userId, allowedRoles = ["OWNER", "EDITOR"]) {
  if (!mongoose.isValidObjectId(workspaceId)) {
    const error = new Error("Workspace not found");
    error.status = 404;
    throw error;
  }
  const access = await getWorkspaceMembership(workspaceId, userId);
  if (!access) {
    const error = new Error("Workspace not found");
    error.status = 404;
    throw error;
  }
  if (!allowedRoles.includes(access.role)) {
    const error = new Error("Only workspace owners and editors can manage API keys");
    error.status = 403;
    throw error;
  }
  return access;
}

function keyDto(key, currentUserId) {
  return {
    id: key._id,
    name: key.name,
    prefix: key.keyPrefix,
    scopes: key.scopes,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    requestCount: key.requestCount,
    revokedAt: key.revokedAt,
    createdByCurrentUser: currentUserId ? key.user.toString() === currentUserId.toString() : false,
    status: key.revokedAt ? "revoked" : "active"
  };
}

async function listApiKeys(req, res) {
  try {
    const { workspace } = await getWorkspaceAccess(req.params.workspaceId, req.userId, ["OWNER", "EDITOR", "VIEWER"]);
    const keys = await ApiKey.find({ workspace: workspace._id }).select("+keyPrefix").sort({ createdAt: -1 });
    return res.json({ keys: keys.map((key) => keyDto(key, req.userId)) });
  } catch (error) {
    return sendError(res, error, "Failed to load API keys");
  }
}

async function createApiKey(req, res) {
  try {
    const { workspace } = await getWorkspaceAccess(req.params.workspaceId, req.userId);
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const scopes = body.scopes;
    const allowedScopes = new Set(ApiKey.API_KEY_SCOPES);
    if (!name || name.length > 80) {
      return res.status(400).json({ message: "API key name must be between 1 and 80 characters" });
    }
    if (!Array.isArray(scopes) || scopes.length === 0 ||
        scopes.some((scope) => typeof scope !== "string" || !allowedScopes.has(scope)) ||
        new Set(scopes).size !== scopes.length) {
      return res.status(400).json({ message: "Select one or more supported API scopes without duplicates" });
    }

    const rawKey = `sb_live_${crypto.randomBytes(32).toString("hex")}`;
    const keyPrefix = rawKey.slice(0, 24);
    const key = await ApiKey.create({
      name,
      keyPrefix,
      keyHash: crypto.createHash("sha256").update(rawKey).digest("hex"),
      user: req.userId,
      workspace: workspace._id,
      scopes
    });
    return res.status(201).json({
      key: keyDto(key, req.userId),
      apiKey: rawKey,
      warning: "Copy this key now. It cannot be displayed again."
    });
  } catch (error) {
    return sendError(res, error, "Failed to create API key");
  }
}

async function revokeApiKey(req, res) {
  try {
    const { workspace, role } = await getWorkspaceAccess(req.params.workspaceId, req.userId);
    if (!mongoose.isValidObjectId(req.params.keyId)) {
      return res.status(404).json({ message: "API key not found" });
    }
    const key = await ApiKey.findOne({ _id: req.params.keyId, workspace: workspace._id });
    if (!key) return res.status(404).json({ message: "API key not found" });
    if (role !== "OWNER" && key.user.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Editors can revoke only API keys they created" });
    }
    if (!key.revokedAt) {
      key.revokedAt = new Date();
      await key.save();
    }
    return res.json({ key: keyDto(key, req.userId) });
  } catch (error) {
    return sendError(res, error, "Failed to revoke API key");
  }
}

async function getApiUsage(req, res) {
  try {
    const { workspace } = await getWorkspaceAccess(req.params.workspaceId, req.userId, ["OWNER", "EDITOR", "VIEWER"]);
    const keys = await ApiKey.find({ workspace: workspace._id }).select("requestCount lastUsedAt revokedAt");
    const activeKeys = keys.filter((key) => !key.revokedAt);
    return res.json({
      usage: {
        activeKeys: activeKeys.length,
        totalKeys: keys.length,
        requests: keys.reduce((total, key) => total + key.requestCount, 0),
        lastUsedAt: keys.reduce((latest, key) =>
          key.lastUsedAt && (!latest || key.lastUsedAt > latest) ? key.lastUsedAt : latest, null)
      }
    });
  } catch (error) {
    return sendError(res, error, "Failed to load API usage");
  }
}

module.exports = { listApiKeys, createApiKey, revokeApiKey, getApiUsage };
