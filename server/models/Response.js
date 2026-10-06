const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  { _id: false }
);

const responseSchema = new mongoose.Schema(
  {
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: true
    },
    distributionRecipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SurveyRecipient",
      default: null,
      index: true
    },
    answers: {
      type: [answerSchema],
      default: []
    },
    skippedQuestionIds: {
      type: [String],
      default: []
    },
    notReachedQuestionIds: {
      type: [String],
      default: []
    },
    reachedQuestionIds: {
      type: [String],
      default: []
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    },
    // Index of the last question the respondent reached - powers drop-off analytics
    lastQuestionReached: {
      type: Number,
      default: 0
    },
    isAnonymous: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Response", responseSchema);
