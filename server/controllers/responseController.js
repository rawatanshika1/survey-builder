const Response = require("../models/Response");
const Survey = require("../models/Survey");

// GET /api/surveys/public/:slug  (no auth - public route)
async function getPublicSurvey(req, res) {
  try {
    const survey = await Survey.findOne({ slug: req.params.slug, status: "published" }).select(
      "title description category mode expirationDate questions slug"
    );

    if (!survey) {
      return res.status(404).json({ message: "Survey not found or not published" });
    }

    if (survey.expirationDate && new Date(survey.expirationDate) < new Date()) {
      return res.status(410).json({ message: "This survey has expired" });
    }

    res.json({ survey });
  } catch (err) {
    console.error("Get public survey error:", err.message);
    res.status(500).json({ message: "Failed to load survey" });
  }
}

// POST /api/responses/start
async function startResponse(req, res) {
  try {
    const { surveyId } = req.body;

    if (!surveyId) {
      return res.status(400).json({ message: "surveyId is required" });
    }

    const survey = await Survey.findOne({ _id: surveyId, status: "published" });
    if (!survey) {
      return res.status(404).json({ message: "Survey not found or not published" });
    }

    const response = await Response.create({
      surveyId,
      startedAt: new Date(),
      lastQuestionReached: 0
    });

    res.status(201).json({ responseId: response._id });
  } catch (err) {
    console.error("Start response error:", err.message);
    res.status(500).json({ message: "Failed to start response" });
  }
}

// PATCH /api/responses/:id/progress
async function updateProgress(req, res) {
  try {
    const { questionIndex } = req.body;

    if (questionIndex === undefined) {
      return res.status(400).json({ message: "questionIndex is required" });
    }

    const response = await Response.findById(req.params.id);
    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    if (questionIndex > response.lastQuestionReached) {
      response.lastQuestionReached = questionIndex;
      await response.save();
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Update progress error:", err.message);
    res.status(500).json({ message: "Failed to update progress" });
  }
}

// POST /api/responses/:id/submit
async function submitResponse(req, res) {
  try {
    const { answers } = req.body;

    const response = await Response.findById(req.params.id);
    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    response.answers = answers || [];
    response.completedAt = new Date();
    await response.save();

    res.json({ message: "Response submitted", response });
  } catch (err) {
    console.error("Submit response error:", err.message);
    res.status(500).json({ message: "Failed to submit response" });
  }
}

module.exports = { getPublicSurvey, startResponse, updateProgress, submitResponse };
