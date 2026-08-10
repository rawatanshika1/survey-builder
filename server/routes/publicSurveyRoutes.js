const express = require("express");
const router = express.Router();
const { getPublicSurvey } = require("../controllers/responseController");

// GET /api/surveys/public/:slug
router.get("/:slug", getPublicSurvey);

module.exports = router;
