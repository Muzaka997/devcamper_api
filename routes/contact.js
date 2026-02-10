const express = require("express");
const { sendContactMessage } = require("../controllers/contact");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Require authentication so the sender email can be enforced to match the account
router.post("/", protect, sendContactMessage);

module.exports = router;
