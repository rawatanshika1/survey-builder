require("dotenv").config();
const connectDB = require("./config/db");
const app = require("./app");

// Connect to MongoDB, then start the server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

module.exports = app;
