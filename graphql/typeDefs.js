// GraphQL schema (thin slice: read-only courses)
const { gql } = require("graphql-tag");

const typeDefs = gql`
  type CourseImage {
    url: String
    publicId: String
  }

  type WeekContent {
    type: String
    title: String
    url: String
    description: String
  }

  type CourseWeek {
    week: Int
    content: [WeekContent]
  }

  type Course {
    id: ID!
    title: String!
    description: String!
    weeks: String
    tuition: Float
    minimumSkill: String
    scholarshipAvailable: Boolean
    createdAt: String
    image: CourseImage
    Weeks: [CourseWeek]
  }

  type BookImage {
    url: String
    publicId: String
  }

  type Book {
    id: ID!
    title: String!
    author: String!
    description: String!
    image: BookImage
    pdf: String
  }

  # Note: correctAnswer is intentionally NOT exposed — clients never need it,
  # and the grading result (with correct answers) comes back from the REST
  # submit endpoint after a test is taken.
  type Question {
    id: String!
    question: String!
    options: [String!]!
  }

  type Test {
    id: ID!
    courseTitle: String!
    title: String!
    timeLimitMinutes: Int!
    passingScore: Int!
    questions: [Question!]!
    createdAt: String
  }

  type Query {
    # List all courses
    courses: [Course!]!
    # Get a single course by id
    course(id: ID!): Course
    # List all books
    books: [Book!]!
    # Get a single book by id
    book(id: ID!): Book
    # List all tests
    tests: [Test!]!
    # Get a single test by id
    test(id: ID!): Test
  }
`;

module.exports = typeDefs;
