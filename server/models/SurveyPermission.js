const mongoose = require("mongoose");

const surveyPermissionSchema = new mongoose.Schema(
  {
    survey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: {
      type: String,
      enum: ["EDITOR", "VIEWER"],
      required: true
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

surveyPermissionSchema.index({ survey: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("SurveyPermission", surveyPermissionSchema);
