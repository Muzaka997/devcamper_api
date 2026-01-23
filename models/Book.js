const mongoose = require("mongoose");

const BookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
  },
  author: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    url: String,
    publicId: String,
  },
  pdf: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Book", BookSchema);
