const express = require("express");
const { sendContactMessage } = require("../controllers/contact");

const router = express.Router();

// Allow public contact submissions (no auth required)
router.post("/", sendContactMessage);

module.exports = router;
