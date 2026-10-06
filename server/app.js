const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const surveyRoutes = require("./routes/surveyRoutes");
const publicSurveyRoutes = require("./routes/publicSurveyRoutes");
const responseRoutes = require("./routes/responseRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const distributionRoutes = require("./routes/distributionRoutes");
const developerRoutes = require("./routes/developerRoutes");
const v1Routes = require("./routes/v1Routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.json({
    message: "Survey Builder API is running.",
    api: "/api/health",
    client: "http://localhost:5177/"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/v1", v1Routes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/distribution", distributionRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/surveys/public", publicSurveyRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api/responses", responseRoutes);

app.use((error, req, res, next) => {
  if (req.path.startsWith("/api/v1/") || req.path === "/api/v1") {
    const status = error.status === 413 ? 413 : 400;
    return res.status(status).json({
      success: false,
      data: null,
      error: {
        code: status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
        message: status === 413 ? "Request payload is too large." : "Request could not be parsed."
      }
    });
  }
  return next(error);
});

module.exports = app;
