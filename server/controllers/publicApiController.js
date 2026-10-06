const mongoose = require("mongoose");
const Survey = require("../models/Survey");
const Response = require("../models/Response");

const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 1000;

function success(res, data) {
  return res.json({ success: true, data, error: null });
}

function failure(res, status, code, message) {
  return res.status(status).json({ success: false, data: null, error: { code, message } });
}

function pagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 50 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE ||
      !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    return null;
  }
  return { page, limit, skip: (page - 1) * limit };
}

function publicSurvey(survey, includeQuestions = false) {
  const result = {
    id: survey._id,
    title: survey.title,
    description: survey.description,
    category: survey.category,
    status: survey.status,
    mode: survey.mode,
    slug: survey.slug,
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt
  };
  if (includeQuestions) {
    result.questions = survey.questions.map((question) => ({
      id: question._id,
      type: question.type,
      questionText: question.questionText,
      description: question.description,
      options: question.options,
      required: question.required,
      order: question.order
    }));
  }
  return result;
}

async function listSurveys(req, res) {
  const page = pagination(req.query);
  if (!page) return failure(res, 400, "INVALID_PAGINATION", "Page must be 1-1000 and limit must be 1-100.");
  try {
    const filter = { workspaceId: req.apiKey.workspaceId };
    const [surveys, total] = await Promise.all([
      Survey.find(filter).select("title description category status mode slug createdAt updatedAt")
        .sort({ createdAt: -1, _id: -1 }).skip(page.skip).limit(page.limit),
      Survey.countDocuments(filter)
    ]);
    return success(res, {
      surveys: surveys.map((survey) => publicSurvey(survey)),
      pagination: { page: page.page, limit: page.limit, total, pages: Math.ceil(total / page.limit) }
    });
  } catch (error) {
    console.error("Public API survey listing failed", error.message);
    return failure(res, 500, "INTERNAL_ERROR", "Unable to list surveys.");
  }
}

async function getSurvey(req, res) {
  if (!mongoose.isValidObjectId(req.params.surveyId)) {
    return failure(res, 400, "INVALID_SURVEY_ID", "Survey ID must be a valid identifier.");
  }
  try {
    const survey = await Survey.findOne({
      _id: req.params.surveyId,
      workspaceId: req.apiKey.workspaceId
    });
    if (!survey) return failure(res, 404, "NOT_FOUND", "Survey not found in this workspace.");
    return success(res, { survey: publicSurvey(survey, true) });
  } catch (error) {
    console.error("Public API survey lookup failed", error.message);
    return failure(res, 500, "INTERNAL_ERROR", "Unable to load this survey.");
  }
}

async function listSurveyResponses(req, res) {
  if (!mongoose.isValidObjectId(req.params.surveyId)) {
    return failure(res, 400, "INVALID_SURVEY_ID", "Survey ID must be a valid identifier.");
  }
  const page = pagination(req.query);
  if (!page) return failure(res, 400, "INVALID_PAGINATION", "Page must be 1-1000 and limit must be 1-100.");
  try {
    const survey = await Survey.findOne({
      _id: req.params.surveyId,
      workspaceId: req.apiKey.workspaceId
    }).select("_id");
    if (!survey) return failure(res, 404, "NOT_FOUND", "Survey not found in this workspace.");
    const filter = { surveyId: survey._id, completedAt: { $ne: null } };
    const [responses, total] = await Promise.all([
      Response.find(filter).select("answers reachedQuestionIds skippedQuestionIds notReachedQuestionIds startedAt completedAt")
        .sort({ completedAt: -1, _id: -1 }).skip(page.skip).limit(page.limit),
      Response.countDocuments(filter)
    ]);
    return success(res, {
      responses: responses.map((response) => ({
        id: response._id,
        answers: response.answers,
        reachedQuestionIds: response.reachedQuestionIds,
        skippedQuestionIds: response.skippedQuestionIds,
        notReachedQuestionIds: response.notReachedQuestionIds,
        startedAt: response.startedAt,
        completedAt: response.completedAt
      })),
      pagination: { page: page.page, limit: page.limit, total, pages: Math.ceil(total / page.limit) }
    });
  } catch (error) {
    console.error("Public API response listing failed", error.message);
    return failure(res, 500, "INTERNAL_ERROR", "Unable to list survey responses.");
  }
}

module.exports = { listSurveys, getSurvey, listSurveyResponses };
