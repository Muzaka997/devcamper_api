const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const colors = require("colors");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
const xss = require("xss-clean");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const errorHandler = require("./middleware/error");
const connectDB = require("./config/db");
const mongoose = require("mongoose");
const cors = require("cors");

//Load env vars
dotenv.config({ path: "./config/config.env" });

// Connect to database with explicit startup logs
const startDatabase = async () => {
  console.log("Starting database connection...".yellow);
  try {
    await connectDB();
    console.log("Database connection established".green);
  } catch (err) {
    console.error("Database connection failed:", err.message || err);
    // Do not exit here; let error surface to logs so Vercel shows the failure
  }
};

startDatabase();

//Route files

const courses = require("./routes/courses");
const auth = require("./routes/auth");
const users = require("./routes/users");
const books = require("./routes/books");
const tests = require("./routes/tests");

const app = express();

// BODY PARSER
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Dev logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Sanitize data
app.use(
  mongoSanitize({
    replaceWith: "_",
  }),
);

// Set security headers
// app.use(helmet());

// Prevent XSS attacks
app.use(xss());

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100,
});
app.use(limiter);

// Prevent http param pollution
app.use(hpp());

// Enable CORS
const allowedOrigins = [
  "https://learning-app-inky-tau.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser tools (curl, Postman)
      return allowedOrigins.includes(origin)
        ? callback(null, true)
        : callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// File uploading
// app.use(fileUpload());

// Set static folder
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

// Ensure DB connected before handling requests (prevents errors when bufferCommands=false)
const ensureDBConnected = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) return next();
    await connectDB();
    return next();
  } catch (err) {
    return next(err);
  }
};

app.use(ensureDBConnected);

// Health check for serverless function / monitoring
app.get("/api/health", (req, res) => {
  return res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/v1/courses", courses);
app.use("/api/v1/auth", auth);
app.use("/api/v1/users", users);
app.use("/api/v1/books", books);
app.use("/api/v1/tests", tests);

app.use(errorHandler);

const PORT = process.env.PORT || 5001;

let server;

// Start server only when this file is run directly (not when required by a serverless wrapper)
if (require.main === module) {
  server = app.listen(
    PORT,
    console.log(
      `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow
        .bold,
    ),
  );
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  //Close server & exit process
  if (server && server.close) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Export app for serverless wrapper and testing
module.exports = app;
