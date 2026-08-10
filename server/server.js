require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const surveyRoutes = require("./routes/surveyRoutes");
const publicSurveyRoutes = require("./routes/publicSurveyRoutes");
const responseRoutes = require("./routes/responseRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Root route for server info
app.get("/", (req, res) => {
  res.json({
    message: "Survey Builder API is running.",
    api: "/api/health",
    client: "http://localhost:5177/"
  });
});

// Routes
app.use("/api/auth", authRoutes);
// Public routes must be mounted BEFORE the protected /api/surveys routes,
// since surveyRoutes applies auth middleware to everything under it.
app.use("/api/surveys/public", publicSurveyRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api/responses", responseRoutes);

// Connect to MongoDB, then start the server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

module.exports = app;
