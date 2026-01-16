const express = require("express");
const { getBooks } = require("../controllers/books");

const router = express.Router();

router.get("/", getBooks);

module.exports = router;
