const mongoose = require("mongoose");

const QUESTION_TYPES = [
  "short-answer",
  "long-answer",
  "multiple-choice",
  "checkboxes",
  "dropdown",
  "rating",
  "number",
  "nps",
  "yes-no"
];

const questionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: QUESTION_TYPES,
      required: true
    },
    questionText: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    options: {
      type: [String],
      default: []
    },
    required: {
      type: Boolean,
      default: false
    },
    order: {
      type: Number,
      required: true
    }
  },
  { _id: true }
);

const logicConditionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    operator: {
      type: String,
      enum: ["equals", "notEquals", "contains", "greaterThan", "lessThan"],
      required: true
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { _id: false }
);

const logicRuleSchema = new mongoose.Schema(
  {
    sourceQuestionId: { type: String, required: true },
    match: { type: String, enum: ["all", "any"], default: "all" },
    conditions: { type: [logicConditionSchema], default: [] },
    action: { type: String, enum: ["goto", "end"], required: true },
    destinationQuestionId: { type: String, default: null },
    order: { type: Number, required: true }
  },
  { _id: true }
);

const surveySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Survey title is required"],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    category: {
      type: String,
      trim: true,
      default: "General"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft"
    },
    mode: {
      type: String,
      enum: ["classic", "conversational"],
      default: "classic"
    },
    expirationDate: {
      type: Date,
      default: null
    },
    slug: {
      type: String,
      unique: true,
      sparse: true
    },
    questions: {
      type: [questionSchema],
      default: []
    },
    logicRules: {
      type: [logicRuleSchema],
      default: []
    },
    // Cached AI-generated insights per question, keyed by question id.
    // Regenerated only when the user clicks "Refresh Insights" to avoid
    // excessive LLM API calls.
    insightsCache: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Survey", surveySchema);
module.exports.QUESTION_TYPES = QUESTION_TYPES;
