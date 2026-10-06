const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  inviteMember,
  updateMemberRole,
  removeMember
} = require("../controllers/workspaceController");

router.use(authMiddleware);

router.get("/", listWorkspaces);
router.post("/", createWorkspace);
router.get("/:id", getWorkspace);
router.patch("/:id", updateWorkspace);
router.post("/:id/invitations", inviteMember);
router.patch("/:id/members/:userId", updateMemberRole);
router.delete("/:id/members/:userId", removeMember);

module.exports = router;
