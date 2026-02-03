const express = require("express");

const { protect } = require("../middleware/auth");
const { getSingleTest, submitTest } = require("../controllers/users");
const { getTests } = require("../controllers/tests");

const router = express.Router();

router.get("/", getTests);


module.exports = router;
