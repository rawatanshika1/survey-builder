const express = require("express");
const { trackOpen, trackClick } = require("../controllers/distributionController");

const router = express.Router();

router.get("/open/:token.gif", trackOpen);
router.get("/click/:token", trackClick);

module.exports = router;
