const express = require("express");
const { getTests, getTest } = require("../controllers/tests");

const router = express.Router();

router.get("/", getTests);
router.get("/:id", getTest);

module.exports = router;
