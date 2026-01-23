const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
const connectDB = require("../config/db");
const Book = require("../models/Book");

dotenv.config({ path: "./config/config.env" });

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const uploadsDir = path.join(__dirname, "..", "public", "uploads");

const migrateImages = async () => {
  await connectDB();

  const books = await Book.find();

  for (const book of books) {
    // Skip if already migrated
    if (!book.image || book.image.startsWith("http")) continue;

    const localImagePath = path.join(uploadsDir, book.image);

    if (!fs.existsSync(localImagePath)) {
      console.log(`❌ Missing file: ${book.image}`);
      continue;
    }

    console.log(`⬆️ Uploading ${book.image}`);

    const result = await cloudinary.uploader.upload(localImagePath, {
      folder: "book-covers",
      resource_type: "image",
    });

    book.image = result.secure_url;
    await book.save();

    console.log(`✅ Migrated: ${book.title}`);
  }

  console.log("🎉 Image migration complete");
  process.exit(0);
};

migrateImages();
