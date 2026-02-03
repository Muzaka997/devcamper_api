const mongoose = require("mongoose");
const colors = require("colors");

// Configure mongoose for serverless-friendly behavior
mongoose.set("bufferCommands", false); // don't buffer model operations if not connected

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Recommended options
      serverSelectionTimeoutMS: 10000, // 10s timeout for initial server selection
    });

    console.log(
      `MongoDB Connected: ${conn.connection.host}`.cyan.underline.bold,
    );
    return conn;
  } catch (err) {
    console.error("MongoDB connection error:", err.message || err);
    // Rethrow so caller can handle the failure (and logs show the reason)
    throw err;
  }
};

// Log connection events
mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected".yellow);
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected".cyan);
});

module.exports = connectDB;
