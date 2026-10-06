const mongoose = require("mongoose");

const surveyRecipientSchema = new mongoose.Schema(
  {
    survey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    tokenHash: {
      type: String,
      required: true,
      select: false
    },
    emailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending"
    },
    sentAt: { type: Date, default: null },
    sendCount: { type: Number, default: 0 },
    reminderCount: { type: Number, default: 0 },
    openedAt: { type: Date, default: null },
    openCount: { type: Number, default: 0 },
    clickedAt: { type: Date, default: null },
    clickCount: { type: Number, default: 0 },
    respondedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    lastError: { type: String, default: "" }
  },
  { timestamps: true }
);

surveyRecipientSchema.index({ survey: 1, email: 1 }, { unique: true });
surveyRecipientSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("SurveyRecipient", surveyRecipientSchema);
