const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getInvitation, acceptInvitation } = require("../controllers/workspaceController");

router.get("/:token", getInvitation);
router.post("/:token/accept", authMiddleware, acceptInvitation);

module.exports = router;
