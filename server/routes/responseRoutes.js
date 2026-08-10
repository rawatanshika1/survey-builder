const express = require("express");
const router = express.Router();
const {
  startResponse,
  updateProgress,
  submitResponse
} = require("../controllers/responseController");

router.post("/start", startResponse);
router.patch("/:id/progress", updateProgress);
router.post("/:id/submit", submitResponse);

module.exports = router;
