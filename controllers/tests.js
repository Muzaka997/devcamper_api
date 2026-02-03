const Test = require("../models/Test");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");

// get all tests

exports.getTests = asyncHandler(async (req, res, next) => {
  try {
    const tests = await Test.find();

    res.status(200).json({
      success: true,
      count: tests.length,
      data: tests,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

// get a single test

exports.getTest = asyncHandler(async (req, res, next) => {
  const test = await Test.findById(req.params.id).lean();

  if (!test) {
    return next(new ErrorResponse("Test not found", 404));
  }

  test.questions = test.questions.map(({ correctAnswer, ...q }) => q);

  res.status(200).json({ success: true, data: test });
});
