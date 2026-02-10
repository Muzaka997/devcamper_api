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

// Build allowed frontend origins from env with safe fallbacks
const normalizeOrigin = (o) => (o ? o.replace(/\/$/, "") : o);
const splitEnvList = (v) =>
  (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// Support both single values and comma-separated lists
const ENV_ORIGINS = [
  ...splitEnvList(process.env.FRONTEND_URLS),
  normalizeOrigin(process.env.FRONTEND_URL),
  normalizeOrigin(process.env.FRONTEND_LOCAL_URL),
].filter(Boolean);

const DEFAULT_ORIGINS = [
  // Production app (adjust if your Vercel URL changes)
  "https://learning-app-inky-tau.vercel.app",
  // Local dev (Vite)
  "http://localhost:5173",
];

const allowedOrigins = Array.from(
  new Set([...ENV_ORIGINS, ...DEFAULT_ORIGINS]),
);

// Optional pattern-based allowances (useful for Vercel preview URLs)
// Enable by default for *.vercel.app to avoid CORS issues on preview deployments
const originRegexps = [
  /\.vercel\.app$/i,
  // You can add more patterns via FRONTEND_ORIGIN_PATTERNS env (comma-separated regex bodies)
  ...splitEnvList(process.env.FRONTEND_ORIGIN_PATTERNS)
    .map((p) => {
      try {
        return new RegExp(p, "i");
      } catch {
        return null;
      }
    })
    .filter(Boolean),
];

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
const contact = require("./routes/contact");

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
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        "frame-ancestors": ["'self'", ...allowedOrigins],
      },
    },
    crossOriginResourcePolicy: false,
  }),
);

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
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin header)
      if (!origin) return callback(null, true);

      const normalized = origin.replace(/\/$/, "");

      // Quick allow if exact match
      if (allowedOrigins.includes(normalized)) return callback(null, true);

      // Try hostname-based pattern match (e.g., *.vercel.app previews)
      try {
        const { hostname } = new URL(origin);
        if (originRegexps.some((re) => re.test(hostname))) {
          return callback(null, true);
        }
      } catch {
        // If URL parsing fails, fall through to rejection
      }

      // Otherwise reject with a clear error (helps debugging)
      console.warn(
        `CORS blocked origin: ${origin}. Allowed: ${JSON.stringify(
          allowedOrigins,
        )}`,
      );
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// File uploading
// app.use(fileUpload());

// Set static folder (allow framing from your frontend origins)
app.use(
  "/uploads",
  (req, res, next) => {
    // remove X-Frame-Options added by default and add CSP frame-ancestors
    res.removeHeader("X-Frame-Options");
    const frameAncestors = ["'self'", ...allowedOrigins].join(" ");
    res.setHeader(
      "Content-Security-Policy",
      `frame-ancestors ${frameAncestors}`,
    );
    next();
  },
  express.static(path.join(__dirname, "public/uploads")),
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
app.use("/api/v1/contact", contact);

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
