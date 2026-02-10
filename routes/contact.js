const express = require("express");
const { sendContactMessage } = require("../controllers/contact");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Require authentication: use the account's registered email only
router.post("/", protect, sendContactMessage);

module.exports = router;
