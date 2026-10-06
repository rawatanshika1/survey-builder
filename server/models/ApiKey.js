const mongoose = require("mongoose");

const API_KEY_SCOPES = ["READ_SURVEYS", "READ_RESPONSES"];

const apiKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    keyPrefix: { type: String, required: true, unique: true, select: false },
    keyHash: { type: String, required: true, select: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    scopes: {
      type: [{ type: String, enum: API_KEY_SCOPES }],
      required: true,
      validate: {
        validator: (scopes) => Array.isArray(scopes) && scopes.length > 0 && new Set(scopes).size === scopes.length,
        message: "Choose at least one unique API key scope"
      }
    },
    requestCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

apiKeySchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model("ApiKey", apiKeySchema);
module.exports.API_KEY_SCOPES = API_KEY_SCOPES;
