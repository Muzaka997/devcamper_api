// GraphQL schema: read queries (courses, books, tests) + mutations
// (auth, test submit, contact, profile photo upload).
const { gql } = require("graphql-tag");

const typeDefs = gql`
  # Binary upload scalar (provided by graphql-upload-minimal)
  scalar Upload

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

  type TestResult {
    test: ID
    score: Int
    passed: Boolean
    submitted: Boolean
    takenAt: String
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    profilePhoto: String
    testResults: [TestResult!]!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input AnswerInput {
    questionId: String!
    selectedOption: String!
  }

  type CorrectAnswer {
    questionId: String!
    answer: String!
  }

  type SubmitResult {
    score: Int!
    passed: Boolean!
    correctAnswers: [CorrectAnswer!]!
  }

  type ContactResult {
    sent: Boolean!
    note: String
  }

  type PhotoResult {
    success: Boolean!
    imageUrl: String
  }

  type Query {
    # Currently authenticated user (null-safe: errors if not logged in)
    me: User

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

  type Mutation {
    # Register a new user and return a signed JWT
    register(
      name: String!
      email: String!
      password: String!
      role: String
    ): AuthPayload!
    # Log in and return a signed JWT
    login(email: String!, password: String!): AuthPayload!
    # Submit answers for a test and get the graded result
    submitTest(testId: ID!, answers: [AnswerInput!]!): SubmitResult!
    # Send a contact message from the authenticated account
    sendContactMessage(name: String, message: String!): ContactResult!
    # Upload/replace the authenticated user's profile photo
    uploadProfilePhoto(userId: ID!, file: Upload!): PhotoResult!
  }
`;

module.exports = typeDefs;
