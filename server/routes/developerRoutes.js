const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  getApiUsage
} = require("../controllers/developerController");

const router = express.Router();
router.use(authMiddleware);
router.get("/workspaces/:workspaceId/keys", listApiKeys);
router.post("/workspaces/:workspaceId/keys", createApiKey);
router.delete("/workspaces/:workspaceId/keys/:keyId", revokeApiKey);
router.get("/workspaces/:workspaceId/usage", getApiUsage);

module.exports = router;
