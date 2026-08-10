const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createSurvey,
  getMySurveys,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  publishSurvey
} = require("../controllers/surveyController");
const {
  getAnalytics,
  refreshInsights,
  exportResponses,
  getResponses
} = require("../controllers/analyticsController");

router.use(authMiddleware);

router.post("/", createSurvey);
router.get("/", getMySurveys);
router.get("/:id", getSurveyById);
router.put("/:id", updateSurvey);
router.delete("/:id", deleteSurvey);
router.patch("/:id/publish", publishSurvey);

router.get("/:id/analytics", getAnalytics);
router.post("/:id/insights/:questionId", refreshInsights);
router.get("/:id/export", exportResponses);
router.get("/:id/responses", getResponses);

module.exports = router;
