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
const {
  getSurveyPermissions,
  setSurveyPermission,
  removeSurveyPermission
} = require("../controllers/workspaceController");
const {
  getDistribution,
  addRecipients,
  sendDistribution,
  sendOne
} = require("../controllers/distributionController");

router.use(authMiddleware);

router.get("/:id/permissions", getSurveyPermissions);
router.put("/:id/permissions/:userId", setSurveyPermission);
router.delete("/:id/permissions/:userId", removeSurveyPermission);
router.get("/:id/distribution", getDistribution);
router.post("/:id/distribution/recipients", addRecipients);
router.post("/:id/distribution/send", sendDistribution);
router.post("/:id/distribution/recipients/:recipientId/send", sendOne);

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
