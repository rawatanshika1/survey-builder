const express = require("express");
const { listSurveys, getSurvey, listSurveyResponses } = require("../controllers/publicApiController");
const { apiKeyAuth, requireScope } = require("../middleware/apiKeyAuth");

const router = express.Router();
router.use(apiKeyAuth);
router.get("/surveys", requireScope("READ_SURVEYS"), listSurveys);
router.get("/surveys/:surveyId", requireScope("READ_SURVEYS"), getSurvey);
router.get("/surveys/:surveyId/responses", requireScope("READ_RESPONSES"), listSurveyResponses);
router.use((req, res) => res.status(404).json({
  success: false,
  data: null,
  error: { code: "NOT_FOUND", message: "Versioned API endpoint not found." }
}));

module.exports = router;
