const mongoose = require("mongoose");

// Question schema
const QuestionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: (v) => v.length >= 2,
      message: "A question must have at least 2 options",
    },
  },
  correctAnswer: {
    type: String,
    required: true,
    validate: {
      validator: function (value) {
        return this.options.includes(value);
      },
      message: "Correct answer must match one of the provided options",
    },
  },
});

// Test schema
const TestSchema = new mongoose.Schema({
  courseTitle: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  timeLimitMinutes: {
    type: Number,
    required: true,
  },
  passingScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  },
  questions: {
    type: [QuestionSchema],
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Export the model
module.exports = mongoose.model("Test", TestSchema);
