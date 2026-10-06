const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Workspace name is required"],
      trim: true,
      maxlength: 80
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    isPersonal: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

workspaceSchema.index(
  { owner: 1 },
  { unique: true, partialFilterExpression: { isPersonal: true } }
);

module.exports = mongoose.model("Workspace", workspaceSchema);
