const { Parser } = require("json2csv");
const Survey = require("../models/Survey");
const Response = require("../models/Response");
const callLLMForInsights = require("../utils/callLLMForInsights");

const OPEN_TEXT_TYPES = ["short-answer", "long-answer"];
const CHOICE_TYPES = ["multiple-choice", "checkboxes", "dropdown"];

async function getOwnedSurvey(surveyId, userId) {
  return Survey.findOne({ _id: surveyId, createdBy: userId });
}

// GET /api/surveys/:id/analytics
async function getAnalytics(req, res) {
  try {
    const survey = await getOwnedSurvey(req.params.id, req.userId);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

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
      const answersForQ = responses
        .flatMap((r) => r.answers)
        .filter((a) => a.questionId === qid && a.value !== null && a.value !== "");

      const breakdown = { questionId: qid, questionText: q.questionText, type: q.type };

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
    console.error("Get analytics error:", err.message);
    res.status(500).json({ message: "Failed to load analytics" });
  }
}

// POST /api/surveys/:id/insights/:questionId  (Refresh AI Insights for one question)
async function refreshInsights(req, res) {
  try {
    const survey = await getOwnedSurvey(req.params.id, req.userId);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

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
        message: "AI insights are unavailable right now (check ANTHROPIC_API_KEY on the server)"
      });
    }

    const cache = survey.insightsCache || {};
    cache[req.params.questionId] = { ...insights, generatedAt: new Date() };
    survey.insightsCache = cache;
    survey.markModified("insightsCache");
    await survey.save();

    res.json({ insights: cache[req.params.questionId] });
  } catch (err) {
    console.error("Refresh insights error:", err.message);
    res.status(500).json({ message: "Failed to generate insights" });
  }
}

// GET /api/surveys/:id/export
async function exportResponses(req, res) {
  try {
    const survey = await getOwnedSurvey(req.params.id, req.userId);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

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
        row[q.questionText] = answer
          ? Array.isArray(answer.value)
            ? answer.value.join("; ")
            : answer.value
          : "";
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
    console.error("Export responses error:", err.message);
    res.status(500).json({ message: "Failed to export responses" });
  }
}

// GET /api/surveys/:id/responses
async function getResponses(req, res) {
  try {
    const survey = await getOwnedSurvey(req.params.id, req.userId);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const responses = await Response.find({ surveyId: survey._id }).sort({ createdAt: -1 });

    const questions = survey.questions.sort((a, b) => a.order - b.order);

    const formatted = responses.map((r) => ({
      id: r._id,
      completed: !!r.completedAt,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      answers: questions.map((q) => {
        const found = r.answers.find((a) => a.questionId === q._id.toString());
        return {
          questionText: q.questionText,
          value: found ? found.value : null
        };
      })
    }));

    res.json({ responses: formatted });
  } catch (err) {
    console.error("Get responses error:", err.message);
    res.status(500).json({ message: "Failed to load responses" });
  }
}

module.exports = { getAnalytics, refreshInsights, exportResponses, getResponses };
