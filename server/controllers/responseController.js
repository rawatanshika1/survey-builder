const Response = require("../models/Response");
const Survey = require("../models/Survey");
const { evaluateSurveyPath, hasAnswer } = require("../services/surveyLogic");
const SurveyRecipient = require("../models/SurveyRecipient");
const crypto = require("crypto");

function hashDistributionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// GET /api/surveys/public/:slug  (no auth - public route)
async function getPublicSurvey(req, res) {
  try {
    const survey = await Survey.findOne({ slug: req.params.slug, status: "published" }).select(
      "title description category mode expirationDate questions logicRules slug"
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

    let distributionRecipient = null;
    if (req.body.distributionToken !== undefined) {
      if (typeof req.body.distributionToken !== "string" || !req.body.distributionToken) {
        return res.status(400).json({ message: "Invalid survey invitation token" });
      }
      distributionRecipient = await SurveyRecipient.findOne({
        survey: survey._id,
        tokenHash: hashDistributionToken(req.body.distributionToken)
      }).select("+tokenHash");
      if (!distributionRecipient) {
        return res.status(404).json({ message: "Survey invitation is no longer available" });
      }
      if (distributionRecipient.respondedAt) {
        return res.status(409).json({ message: "This invitation has already been used to submit a response" });
      }
    }

    const response = await Response.create({
      surveyId,
      distributionRecipient: distributionRecipient?._id || null,
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
    if (response.completedAt) {
      return res.status(409).json({ message: "This response has already been submitted" });
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

    const survey = await Survey.findById(response.surveyId);
    if (!survey || survey.status !== "published") {
      return res.status(404).json({ message: "Survey not found or not published" });
    }
    const incomingAnswers = Array.isArray(answers) ? answers : [];
    const validQuestionIds = new Set(survey.questions.map((question) => question._id.toString()));
    if (incomingAnswers.some((answer) => !validQuestionIds.has(String(answer.questionId)))) {
      return res.status(400).json({ message: "Response contains an answer for a question that no longer exists" });
    }
    for (const answer of incomingAnswers) {
      const question = survey.questions.id(String(answer.questionId));
      if (question?.type === "nps" && hasAnswer(answer.value) &&
          (!Number.isInteger(answer.value) || answer.value < 0 || answer.value > 10)) {
        return res.status(400).json({ message: `"${question.questionText}" must be a whole number from 0 to 10` });
      }
    }

    if (survey.logicRules?.length) {
      const answerMap = new Map(incomingAnswers.map((answer) => [String(answer.questionId), answer.value]));
      const path = evaluateSurveyPath(survey.questions, survey.logicRules, answerMap);
      for (const questionId of path.reachedQuestionIds) {
        const question = survey.questions.id(questionId);
        const answer = answerMap.get(questionId);
        if (question.required && !hasAnswer(answer)) {
          return res.status(400).json({ message: `"${question.questionText}" is required` });
        }
        if (question.type === "nps" && hasAnswer(answer) &&
            (!Number.isInteger(answer) || answer < 0 || answer > 10)) {
          return res.status(400).json({ message: `"${question.questionText}" must be a whole number from 0 to 10` });
        }
      }
      const reached = new Set(path.reachedQuestionIds);
      response.answers = incomingAnswers.filter((answer) => reached.has(String(answer.questionId)));
      response.reachedQuestionIds = path.reachedQuestionIds;
      response.skippedQuestionIds = path.skippedQuestionIds;
      response.notReachedQuestionIds = path.notReachedQuestionIds;
    } else {
      for (const question of survey.questions) {
        if (question.type === "nps" && question.required && !hasAnswer(
          incomingAnswers.find((answer) => String(answer.questionId) === question._id.toString())?.value
        )) {
          return res.status(400).json({ message: `"${question.questionText}" is required` });
        }
      }
      response.answers = incomingAnswers;
      response.reachedQuestionIds = survey.questions.map((question) => question._id.toString());
      response.skippedQuestionIds = [];
      response.notReachedQuestionIds = [];
    }
    response.completedAt = new Date();
    await response.save();
    if (response.distributionRecipient) {
      await SurveyRecipient.updateOne(
        { _id: response.distributionRecipient, respondedAt: null },
        { $set: { respondedAt: response.completedAt, lastActivityAt: response.completedAt } }
      );
    }

    res.json({ message: "Response submitted", response });
  } catch (err) {
    console.error("Submit response error:", err.message);
    res.status(500).json({ message: "Failed to submit response" });
  }
}

module.exports = { getPublicSurvey, startResponse, updateProgress, submitResponse };
