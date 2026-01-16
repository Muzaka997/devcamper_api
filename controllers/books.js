const Book = require("../models/Book");

/**
 * @desc    Get all books
 * @route   GET /api/v1/books
 * @access  Public
 */
exports.getBooks = async (req, res) => {
  try {
    const books = await Book.find();

    res.status(200).json({
      success: true,
      count: books.length,
      data: books,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
