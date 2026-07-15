// GraphQL resolvers (thin slice: read-only courses)
// Resolvers reuse the exact same Mongoose models the REST controllers use.
const Course = require("../models/Course");
const Book = require("../models/Book");

const resolvers = {
  Query: {
    courses: async () => {
      return Course.find();
    },
    course: async (_parent, { id }) => {
      return Course.findById(id);
    },
    books: async () => {
      return Book.find();
    },
    book: async (_parent, { id }) => {
      return Book.findById(id);
    },
  },
  Course: {
    // Mongoose exposes an `id` virtual (hex string of _id) automatically,
    // so most fields map straight through. Only createdAt needs coercing
    // from a Date to a stable string.
    createdAt: (course) =>
      course.createdAt ? new Date(course.createdAt).toISOString() : null,
  },
};

module.exports = resolvers;
