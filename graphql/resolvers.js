// GraphQL resolvers.
// Resolvers reuse the exact same Mongoose models (and helpers) the REST
// controllers use, so behavior stays consistent across REST and GraphQL.
const { GraphQLError } = require("graphql");
const { GraphQLUpload } = require("graphql-upload-minimal");
const cloudinary = require("cloudinary").v2;
const Course = require("../models/Course");
const Book = require("../models/Book");
const Test = require("../models/Test");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Cloudinary config (same env vars the REST controller uses)
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const requireAuth = (user) => {
  if (!user) {
    throw new GraphQLError("Not authorized", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return user;
};

const resolvers = {
  Upload: GraphQLUpload,

  Query: {
    me: async (_parent, _args, { user }) => {
      requireAuth(user);
      // Re-fetch to ensure fresh testResults etc.
      return User.findById(user.id);
    },
    courses: async () => Course.find(),
    course: async (_parent, { id }) => Course.findById(id),
    books: async () => Book.find(),
    book: async (_parent, { id }) => Book.findById(id),
    tests: async () => Test.find(),
    test: async (_parent, { id }) => Test.findById(id),
  },

  Mutation: {
    register: async (_parent, { name, email, password, role }) => {
      const user = await User.create({ name, email, password, role });
      return { token: user.getSignedJwtToken(), user };
    },

    login: async (_parent, { email, password }) => {
      if (!email || !password) {
        throw new GraphQLError("Please provide an email and password", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const user = await User.findOne({ email }).select("+password");
      if (!user || !(await user.matchPassword(password))) {
        throw new GraphQLError("Invalid credentials", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return { token: user.getSignedJwtToken(), user };
    },

    // Mirrors controllers/users.js submitTest
    submitTest: async (_parent, { testId, answers }, { user }) => {
      requireAuth(user);

      const test = await Test.findById(testId);
      if (!test) {
        throw new GraphQLError("Test not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const dbUser = await User.findById(user.id);
      const alreadyTaken = dbUser.testResults.some(
        (r) => r.test.toString() === testId,
      );
      if (alreadyTaken) {
        throw new GraphQLError("You have already taken this test", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      let correct = 0;
      test.questions.forEach((q) => {
        const userAnswer = answers.find((a) => a.questionId === q.id);
        if (userAnswer?.selectedOption === q.correctAnswer) correct++;
      });

      const score = Math.round((correct / test.questions.length) * 100);
      const passed = score >= test.passingScore;

      dbUser.testResults.push({ test: test._id, score, passed, submitted: true });
      await dbUser.save();

      return {
        score,
        passed,
        correctAnswers: test.questions.map((q) => ({
          questionId: q.id,
          answer: q.correctAnswer,
        })),
      };
    },

    // Mirrors controllers/contact.js
    sendContactMessage: async (_parent, { name, message }, { user }) => {
      requireAuth(user);
      if (!message || typeof message !== "string" || message.trim().length < 3) {
        throw new GraphQLError("A valid message is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const senderEmail = user.email;
      const displayName = (name || user.name || "User").toString().trim();
      const to = process.env.CONTACT_RECIPIENT_EMAIL || process.env.FROM_EMAIL;
      if (!to) {
        throw new GraphQLError("Email recipient not configured on server", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }

      const subject = `New contact message from ${displayName}`;
      const composed = `From: ${displayName} <${senderEmail}>\n\nMessage:\n${message}`;
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333">
          <p><strong>From:</strong> ${displayName} &lt;${senderEmail}&gt;</p>
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-line">${message}</p>
        </div>`;

      try {
        await sendEmail({ email: to, subject, message: composed, html, replyTo: senderEmail });
        return { sent: true, note: null };
      } catch (err) {
        // Don't fail the request on hosts that block SMTP; mirror REST behavior
        console.warn("Contact email send failed:", err?.message || err);
        return { sent: false, note: "email_not_sent" };
      }
    },

    // Mirrors controllers/users.js userPhotoUpload, but receives the file
    // via the GraphQL multipart Upload scalar.
    uploadProfilePhoto: async (_parent, { userId, file }, { user }) => {
      requireAuth(user);
      if (user.id !== userId && user.role !== "publisher") {
        throw new GraphQLError("Not authorized to update this user", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const { createReadStream } = await file;

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "users" },
          (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
        );
        createReadStream().pipe(uploadStream);
      });

      const target = await User.findById(userId);
      if (!target) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      // Delete old image
      if (target.profilePhoto) {
        const publicId = target.profilePhoto.split("/").pop().split(".")[0];
        try {
          await cloudinary.uploader.destroy(`users/${publicId}`);
        } catch (_) {
          // non-fatal
        }
      }

      target.profilePhoto = result.secure_url;
      await target.save();

      return { success: true, imageUrl: result.secure_url };
    },
  },

  Course: {
    createdAt: (course) =>
      course.createdAt ? new Date(course.createdAt).toISOString() : null,
  },
  Test: {
    createdAt: (test) =>
      test.createdAt ? new Date(test.createdAt).toISOString() : null,
  },
  TestResult: {
    test: (tr) => (tr.test ? tr.test.toString() : null),
    takenAt: (tr) => (tr.takenAt ? new Date(tr.takenAt).toISOString() : null),
  },
};

module.exports = resolvers;
