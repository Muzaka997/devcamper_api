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

  type Query {
    # List all courses
    courses: [Course!]!
    # Get a single course by id
    course(id: ID!): Course
  }
`;

module.exports = typeDefs;
