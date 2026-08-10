const Survey = require("../models/Survey");
const generateSlug = require("../utils/generateSlug");

// POST /api/surveys
async function createSurvey(req, res) {
  try {
    const { title, description, category, mode, expirationDate, questions } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Survey title is required" });
    }

    const survey = await Survey.create({
      title,
      description,
      category,
      mode,
      expirationDate: expirationDate || null,
      questions: questions || [],
      createdBy: req.userId
    });

    res.status(201).json({ survey });
  } catch (err) {
    console.error("Create survey error:", err.message);
    res.status(500).json({ message: "Failed to create survey" });
  }
}

// GET /api/surveys
async function getMySurveys(req, res) {
  try {
    const { search, category, status, sort } = req.query;

    const filter = { createdBy: req.userId };

    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }
    if (category) {
      filter.category = category;
    }
    if (status) {
      filter.status = status;
    }

    const sortOption = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

    const surveys = await Survey.find(filter).sort(sortOption);
    res.json({ surveys });
  } catch (err) {
    console.error("Get surveys error:", err.message);
    res.status(500).json({ message: "Failed to fetch surveys" });
  }
}

// GET /api/surveys/:id
async function getSurveyById(req, res) {
  try {
    const survey = await Survey.findOne({ _id: req.params.id, createdBy: req.userId });
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }
    res.json({ survey });
  } catch (err) {
    console.error("Get survey error:", err.message);
    res.status(500).json({ message: "Failed to fetch survey" });
  }
}

// PUT /api/surveys/:id
async function updateSurvey(req, res) {
  try {
    const survey = await Survey.findOne({ _id: req.params.id, createdBy: req.userId });
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const { title, description, category, mode, status, expirationDate, questions } = req.body;

    if (title !== undefined) survey.title = title;
    if (description !== undefined) survey.description = description;
    if (category !== undefined) survey.category = category;
    if (mode !== undefined) survey.mode = mode;
    if (status !== undefined) survey.status = status;
    if (expirationDate !== undefined) survey.expirationDate = expirationDate;
    if (questions !== undefined) survey.questions = questions;

    await survey.save();
    res.json({ survey });
  } catch (err) {
    console.error("Update survey error:", err.message);
    res.status(500).json({ message: "Failed to update survey" });
  }
}

// DELETE /api/surveys/:id
async function deleteSurvey(req, res) {
  try {
    const survey = await Survey.findOneAndDelete({ _id: req.params.id, createdBy: req.userId });
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }
    res.json({ message: "Survey deleted" });
  } catch (err) {
    console.error("Delete survey error:", err.message);
    res.status(500).json({ message: "Failed to delete survey" });
  }
}

// PATCH /api/surveys/:id/publish
async function publishSurvey(req, res) {
  try {
    const survey = await Survey.findOne({ _id: req.params.id, createdBy: req.userId });
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    if (!survey.questions || survey.questions.length === 0) {
      return res.status(400).json({ message: "Add at least one question before publishing" });
    }

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

    res.json({ survey });
  } catch (err) {
    console.error("Publish survey error:", err.message);
    res.status(500).json({ message: "Failed to publish survey" });
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
