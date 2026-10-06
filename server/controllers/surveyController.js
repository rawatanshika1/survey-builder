const Survey = require("../models/Survey");
const generateSlug = require("../utils/generateSlug");
const SurveyPermission = require("../models/SurveyPermission");
const SurveyRecipient = require("../models/SurveyRecipient");
const WorkspaceMember = require("../models/WorkspaceMember");
const {
  ensurePersonalWorkspace,
  getWorkspaceMembership,
  requireSurveyAccess,
  roleCapabilities
} = require("../services/workspaceAccess");
const { validateLogicRules } = require("../services/surveyLogic");

function respondWithError(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.name === "CastError") return res.status(404).json({ message: "Resource not found" });
  console.error(fallback, error.message);
  return res.status(500).json({ message: fallback });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// POST /api/surveys
async function createSurvey(req, res) {
  try {
    const { title, description, category, mode, expirationDate, questions, logicRules } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Survey title is required" });
    }

    if (logicRules !== undefined) {
      const logicErrors = validateLogicRules(questions || [], logicRules);
      if (logicErrors.length) return res.status(400).json({ message: logicErrors.join(" ") });
    }

    let workspace;
    if (req.body.workspaceId) {
      const membership = await getWorkspaceMembership(req.body.workspaceId, req.userId);
      if (!membership) return res.status(404).json({ message: "Workspace not found" });
      if (!["OWNER", "EDITOR"].includes(membership.role)) {
        return res.status(403).json({ message: "You don't have permission to create surveys in this workspace" });
      }
      workspace = membership.workspace;
    } else {
      workspace = await ensurePersonalWorkspace(req.userId);
    }

    const survey = await Survey.create({
      title,
      description,
      category,
      mode,
      expirationDate: expirationDate || null,
      questions: questions || [],
      logicRules: logicRules || [],
      createdBy: req.userId,
      workspaceId: workspace._id
    });

    res.status(201).json({ survey });
  } catch (err) {
    return respondWithError(res, err, "Failed to create survey");
  }
}

// GET /api/surveys
async function getMySurveys(req, res) {
  try {
    const { search, category, status, sort } = req.query;

    await ensurePersonalWorkspace(req.userId);
    let workspaceIds;
    if (req.query.workspaceId) {
      const membership = await getWorkspaceMembership(req.query.workspaceId, req.userId);
      if (!membership) return res.status(404).json({ message: "Workspace not found" });
      workspaceIds = [membership.workspace._id];
    } else {
      workspaceIds = await WorkspaceMember.distinct("workspace", { user: req.userId });
    }
    const permissionSurveyIds = await SurveyPermission.distinct("survey", { user: req.userId });
    const permissionScope = req.query.workspaceId
      ? { workspaceId: { $in: workspaceIds } }
      : {};
    const scope = [
      { createdBy: req.userId, $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }] },
      { workspaceId: { $in: workspaceIds } },
      { _id: { $in: permissionSurveyIds }, ...permissionScope }
    ];
    const filter = { $or: scope };

    if (search) {
      filter.title = { $regex: escapeRegex(search), $options: "i" };
    }
    if (category) {
      filter.category = category;
    }
    if (status) {
      filter.status = status;
    }

    const sortOption = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

    const surveys = await Survey.find(filter).populate("createdBy", "name").sort(sortOption);
    const accessible = await Promise.all(surveys.map(async (survey) => {
      const access = await requireSurveyAccess(survey, req.userId, ["OWNER", "EDITOR", "VIEWER"]);
      return { ...survey.toObject(), ...roleCapabilities(access.role) };
    }));
    res.json({ surveys: accessible });
  } catch (err) {
    return respondWithError(res, err, "Failed to fetch surveys");
  }
}

// GET /api/surveys/:id
async function getSurveyById(req, res) {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }
    const access = await requireSurveyAccess(survey, req.userId, ["OWNER", "EDITOR", "VIEWER"]);
    res.json({ survey, ...roleCapabilities(access.role) });
  } catch (err) {
    return respondWithError(res, err, "Failed to fetch survey");
  }
}

// PUT /api/surveys/:id
async function updateSurvey(req, res) {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }
    const access = await requireSurveyAccess(survey, req.userId, ["OWNER", "EDITOR"]);

    const { title, description, category, mode, status, expirationDate, questions, logicRules } = req.body;

    const nextQuestions = questions === undefined ? survey.questions : questions;
    if (logicRules !== undefined) {
      const logicErrors = validateLogicRules(nextQuestions, logicRules);
      if (logicErrors.length) return res.status(400).json({ message: logicErrors.join(" ") });
    } else if (questions !== undefined && survey.logicRules.length) {
      const logicErrors = validateLogicRules(nextQuestions, survey.logicRules);
      if (logicErrors.length) return res.status(400).json({ message: logicErrors.join(" ") });
    }

    if (title !== undefined) survey.title = title;
    if (description !== undefined) survey.description = description;
    if (category !== undefined) survey.category = category;
    if (mode !== undefined) survey.mode = mode;
    if (status !== undefined) survey.status = status;
    if (expirationDate !== undefined) survey.expirationDate = expirationDate;
    if (questions !== undefined) survey.questions = questions;
    if (logicRules !== undefined) survey.logicRules = logicRules;

    await survey.save();
    res.json({ survey, ...roleCapabilities(access.role) });
  } catch (err) {
    return respondWithError(res, err, "Failed to update survey");
  }
}

// DELETE /api/surveys/:id
async function deleteSurvey(req, res) {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }
    await requireSurveyAccess(survey, req.userId, ["OWNER"]);
    await Survey.deleteOne({ _id: survey._id });
    await SurveyPermission.deleteMany({ survey: survey._id });
    await SurveyRecipient.deleteMany({ survey: survey._id });
    res.json({ message: "Survey deleted" });
  } catch (err) {
    return respondWithError(res, err, "Failed to delete survey");
  }
}

// PATCH /api/surveys/:id/publish
async function publishSurvey(req, res) {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }
    const access = await requireSurveyAccess(survey, req.userId, ["OWNER", "EDITOR"]);

    if (!survey.questions || survey.questions.length === 0) {
      return res.status(400).json({ message: "Add at least one question before publishing" });
    }
    const logicErrors = validateLogicRules(survey.questions, survey.logicRules || []);
    if (logicErrors.length) return res.status(400).json({ message: logicErrors.join(" ") });

    if (!survey.slug) {
      let slug = generateSlug();
      // Ensure uniqueness in the unlikely case of a collision
      while (await Survey.findOne({ slug })) {
        slug = generateSlug();
      }
      survey.slug = slug;
    }

    survey.status = "published";
    await survey.save();

    res.json({ survey, ...roleCapabilities(access.role) });
  } catch (err) {
    return respondWithError(res, err, "Failed to publish survey");
  }
}

module.exports = {
  createSurvey,
  getMySurveys,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  publishSurvey
};
