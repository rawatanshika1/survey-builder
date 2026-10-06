const { Parser } = require("json2csv");
const Survey = require("../models/Survey");
const Response = require("../models/Response");
const callLLMForInsights = require("../utils/callLLMForInsights");
const { requireSurveyAccess } = require("../services/workspaceAccess");

const OPEN_TEXT_TYPES = ["short-answer", "long-answer"];
const CHOICE_TYPES = ["multiple-choice", "checkboxes", "dropdown"];

function hasAnswer(value) {
  return value !== undefined &&
    value !== null &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0);
}

function responseAnswerStatus(response, questionId, answer) {
  if (response.skippedQuestionIds?.includes(questionId)) return "skipped";
  if (response.notReachedQuestionIds?.includes(questionId)) return "not-reached";
  return hasAnswer(answer?.value) ? "answered" : "unanswered";
}

async function getAccessibleSurvey(surveyId, userId, roles = ["OWNER", "EDITOR", "VIEWER"]) {
  const survey = await Survey.findById(surveyId);
  if (!survey) {
    const error = new Error("Survey not found");
    error.status = 404;
    throw error;
  }
  await requireSurveyAccess(survey, userId, roles);
  return survey;
}

function respondWithError(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.name === "CastError") return res.status(404).json({ message: "Survey not found" });
  console.error(fallback, error.message);
  return res.status(500).json({ message: fallback });
}

// GET /api/surveys/:id/analytics
async function getAnalytics(req, res) {
  try {
    const survey = await getAccessibleSurvey(req.params.id, req.userId);

    const responses = await Response.find({ surveyId: survey._id });

    const totalResponses = responses.length;
    const completedResponses = responses.filter((r) => r.completedAt).length;
    const completionRate = totalResponses
      ? Math.round((completedResponses / totalResponses) * 100)
      : 0;

    const questions = survey.questions.sort((a, b) => a.order - b.order);

    // --- Per-question breakdown ---
    const perQuestion = questions.map((q) => {
      const qid = q._id.toString();
      const answersByResponse = responses.map((response) => ({
        response,
        answer: response.answers.find((answer) => answer.questionId === qid)
      }));
      const answersForQ = responses
        .flatMap((r) => r.answers)
        .filter((a) => a.questionId === qid && hasAnswer(a.value));

      const breakdown = {
        questionId: qid,
        questionText: q.questionText,
        type: q.type,
        answeredCount: answersForQ.length,
        skippedCount: responses.filter((response) => response.skippedQuestionIds?.includes(qid)).length,
        notReachedCount: responses.filter((response) => response.notReachedQuestionIds?.includes(qid)).length,
        unansweredCount: answersByResponse.filter(({ response, answer }) =>
          response.completedAt &&
          !response.skippedQuestionIds?.includes(qid) &&
          !response.notReachedQuestionIds?.includes(qid) &&
          !hasAnswer(answer?.value)
        ).length
      };

      if (CHOICE_TYPES.includes(q.type)) {
        const counts = {};
        q.options.forEach((opt) => (counts[opt] = 0));
        answersForQ.forEach((a) => {
          const values = Array.isArray(a.value) ? a.value : [a.value];
          values.forEach((v) => {
            if (counts[v] !== undefined) counts[v] += 1;
          });
        });
        breakdown.optionCounts = counts;
      } else if (q.type === "rating") {
        const nums = answersForQ.map((a) => Number(a.value)).filter((n) => !isNaN(n));
        breakdown.average = nums.length
          ? Number((nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(2))
          : 0;
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        nums.forEach((n) => {
          if (distribution[n] !== undefined) distribution[n] += 1;
        });
        breakdown.distribution = distribution;
      } else if (q.type === "yes-no") {
        const counts = { Yes: 0, No: 0 };
        answersForQ.forEach((a) => {
          if (counts[a.value] !== undefined) counts[a.value] += 1;
        });
        breakdown.optionCounts = counts;
      } else if (q.type === "number") {
        const numbers = answersForQ.map((answer) => Number(answer.value)).filter(Number.isFinite);
        breakdown.numericCount = numbers.length;
        breakdown.numericAverage = numbers.length
          ? Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2))
          : null;
      } else if (q.type === "nps") {
        const scores = answersForQ
          .map((answer) => answer.value)
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 10);
        const promoters = scores.filter((score) => score >= 9).length;
        const passives = scores.filter((score) => score >= 7 && score <= 8).length;
        const detractors = scores.filter((score) => score <= 6).length;
        const total = scores.length;
        const distribution = Object.fromEntries(Array.from({ length: 11 }, (_, score) => [
          score,
          scores.filter((value) => value === score).length
        ]));
        breakdown.nps = {
          score: total ? Math.round(((promoters - detractors) / total) * 100) : null,
          promoters,
          passives,
          detractors,
          totalResponses: total,
          promoterPercentage: total ? Number(((promoters / total) * 100).toFixed(1)) : 0,
          passivePercentage: total ? Number(((passives / total) * 100).toFixed(1)) : 0,
          detractorPercentage: total ? Number(((detractors / total) * 100).toFixed(1)) : 0,
          distribution
        };
      } else {
        breakdown.answerCount = answersForQ.length;
      }

      return breakdown;
    });

    // Overall average rating across all rating-type questions
    const ratingBreakdowns = perQuestion.filter((b) => b.type === "rating" && b.average);
    const averageRating = ratingBreakdowns.length
      ? Number(
          (
            ratingBreakdowns.reduce((s, b) => s + b.average, 0) / ratingBreakdowns.length
          ).toFixed(2)
        )
      : null;

    // --- Drop-off / friction analytics (USP feature) ---
    // For each question index, count how many incomplete responses got
    // stuck exactly at that question (lastQuestionReached === index).
    const incomplete = responses.filter((r) => !r.completedAt);
    const dropOff = questions.map((q, index) => {
      const dropOffCount = incomplete.filter((r) => r.lastQuestionReached === index).length;
      const stillActiveAtStart = totalResponses; // simple denominator for rate
      const dropOffRate = stillActiveAtStart
        ? Number(((dropOffCount / stillActiveAtStart) * 100).toFixed(1))
        : 0;
      return {
        questionIndex: index,
        questionText: q.questionText,
        dropOffCount,
        dropOffRate
      };
    });

    res.json({
      totalResponses,
      completedResponses,
      completionRate,
      averageRating,
      perQuestion,
      dropOff
    });
  } catch (err) {
    return respondWithError(res, err, "Failed to load analytics");
  }
}

// POST /api/surveys/:id/insights/:questionId  (Refresh AI Insights for one question)
async function refreshInsights(req, res) {
  try {
    const survey = await getAccessibleSurvey(req.params.id, req.userId, ["OWNER", "EDITOR"]);

    const question = survey.questions.id(req.params.questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (!OPEN_TEXT_TYPES.includes(question.type)) {
      return res.status(400).json({ message: "Insights are only available for text answers" });
    }

    const responses = await Response.find({ surveyId: survey._id });
    const texts = responses
      .flatMap((r) => r.answers)
      .filter((a) => a.questionId === req.params.questionId && a.value)
      .map((a) => String(a.value).trim())
      .filter(Boolean);

    if (texts.length === 0) {
      return res.status(400).json({ message: "No text answers to analyze yet" });
    }

    const insights = await callLLMForInsights(texts);

    if (!insights) {
      return res.status(503).json({
        message: "AI insights are unavailable right now (check GEMINI_API_KEY on the server)"
      });
    }

    const cache = survey.insightsCache || {};
    cache[req.params.questionId] = { ...insights, generatedAt: new Date() };
    survey.insightsCache = cache;
    survey.markModified("insightsCache");
    await survey.save();

    res.json({ insights: cache[req.params.questionId] });
  } catch (err) {
    return respondWithError(res, err, "Failed to generate insights");
  }
}

// GET /api/surveys/:id/export
async function exportResponses(req, res) {
  try {
    const survey = await getAccessibleSurvey(req.params.id, req.userId);

    const responses = await Response.find({ surveyId: survey._id }).sort({ createdAt: 1 });
    const questions = survey.questions.sort((a, b) => a.order - b.order);

    const rows = responses.map((r) => {
      const row = {
        responseId: r._id.toString(),
        startedAt: r.startedAt ? r.startedAt.toISOString() : "",
        completedAt: r.completedAt ? r.completedAt.toISOString() : "",
        completed: !!r.completedAt
      };
      questions.forEach((q) => {
        const answer = r.answers.find((a) => a.questionId === q._id.toString());
        const questionId = q._id.toString();
        const status = r.skippedQuestionIds?.includes(questionId)
          ? "Skipped (logic)"
          : r.notReachedQuestionIds?.includes(questionId)
            ? "Not reached"
            : "";
        row[q.questionText] = answer
          ? Array.isArray(answer.value)
            ? answer.value.join("; ")
            : answer.value
          : status;
      });
      return row;
    });

    if (rows.length === 0) {
      return res.status(400).json({ message: "No responses to export yet" });
    }

    const parser = new Parser();
    const csv = parser.parse(rows);

    res.header("Content-Type", "text/csv");
    res.attachment(`${survey.title.replace(/\s+/g, "-").toLowerCase()}-responses.csv`);
    res.send(csv);
  } catch (err) {
    return respondWithError(res, err, "Failed to export responses");
  }
}

// GET /api/surveys/:id/responses
async function getResponses(req, res) {
  try {
    const survey = await getAccessibleSurvey(req.params.id, req.userId);

    const responses = await Response.find({ surveyId: survey._id }).sort({ createdAt: -1 });

    const questions = survey.questions.sort((a, b) => a.order - b.order);

    const formatted = responses.map((r) => ({
      id: r._id,
      completed: !!r.completedAt,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      answers: questions.map((q) => {
        const questionId = q._id.toString();
        const found = r.answers.find((a) => a.questionId === q._id.toString());
        return {
          questionId,
          questionText: q.questionText,
          value: found ? found.value : null,
          status: responseAnswerStatus(r, questionId, found)
        };
      })
    }));

    res.json({ responses: formatted });
  } catch (err) {
    return respondWithError(res, err, "Failed to load responses");
  }
}

module.exports = { getAnalytics, refreshInsights, exportResponses, getResponses };
