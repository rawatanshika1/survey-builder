const mongoose = require("mongoose");

const QUESTION_TYPES = [
  "short-answer",
  "long-answer",
  "multiple-choice",
  "checkboxes",
  "dropdown",
  "rating",
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
