// controllers/userController.js
const User = require("../models/User");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const Test = require("../models/Test");

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer setup
const storage = multer.memoryStorage();

exports.upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
}).single("photo");

exports.userPhotoUpload = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse("Please upload a file", 400));
  }

  const uploadStream = cloudinary.uploader.upload_stream(
    { folder: "users" },
    async (error, result) => {
      if (error) {
        return next(new ErrorResponse("Cloudinary upload failed", 500));
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return next(new ErrorResponse("User not found", 404));
      }

      // Delete old image
      if (user.profilePhoto) {
        const publicId = user.profilePhoto.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`users/${publicId}`);
      }

      user.profilePhoto = result.secure_url;

      await user.save();

      res.status(200).json({
        success: true,
        imageUrl: result.secure_url,
      });
    },
  );

  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
});

// controllers/tests.js

exports.submitTest = async (req, res) => {
  try {
    const userId = req.user.id; // ← from protect middleware
    const { id: testId } = req.params;
    const { answers } = req.body;

    // Find test
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, error: "Test not found" });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Check if user already took this test
    const alreadyTaken = user.testResults.some(
      (result) => result.test.toString() === testId,
    );
    if (alreadyTaken) {
      return res.status(400).json({
        success: false,
        error: "You have already taken this test",
      });
    }

    // Calculate score
    let correct = 0;
    test.questions.forEach((q) => {
      const userAnswer = answers.find((a) => a.questionId === q.id);
      if (userAnswer?.selectedOption === q.correctAnswer) correct++;
    });

    const score = Math.round((correct / test.questions.length) * 100);
    const passed = score >= test.passingScore;

    // Add result to user
    user.testResults.push({
      test: test._id,
      score,
      passed,
      submitted: true, // <--- THIS is what you need
    });
    await user.save();

    res.status(200).json({
      success: true,
      score,
      passed,
      correctAnswers: Object.fromEntries(
        test.questions.map((q) => [q.id, q.correctAnswer]),
      ),
    });
  } catch (err) {
    console.error("Submit test error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// user has submitted concrete test

exports.getSingleTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, error: "Test not found" });
    }

    const user = await User.findById(req.user.id);

    const existingResult = user.testResults.find(
      (r) => r.test.toString() === test._id.toString(),
    );

    res.status(200).json({
      success: true,
      data: {
        ...test.toObject(),
        alreadySubmitted: !!existingResult,
        userScore: existingResult?.score || null,
        userPassed: existingResult?.passed || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Upload photo and save in DB
// exports.uploadUserPhoto = asyncHandler(async (req, res, next) => {
//   const user = await User.findById(req.params.id); // <-- use URL param
//   if (!user) return next(new ErrorResponse("User not found", 404));

//   if (!req.file) return next(new ErrorResponse("Please upload a file", 400));

//   // Delete old photo if exists
//   if (user.profilePhoto) {
//     const oldPath = path.join(__dirname, "..", "public", user.profilePhoto);
//     if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
//   }

//   // Save new photo URL in DB
//   user.profilePhoto = `/uploads/${req.file.filename}`;
//   await user.save();

//   res.status(200).json({
//     success: true,
//     imageUrl: user.profilePhoto,
//   });
// });

// @desc      Get all users
// @route     GET /api/v1/users
// @access    Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc      Get single user
// @route     GET /api/v1/users/:id
// @access    Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  res.status(200).json({ success: true, data: user });
});

// @desc      Create user
// @route     POST /api/v1/users
// @access    Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
  const user = await User.create(req.body);

  res.status(201).json({ success: true, data: user });
});

// @desc      Update user
// @route     PUT /api/v1/users/:id
// @access    Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: user });
});

// @desc      Delete user
// @route     DELETE /api/v1/users/:id
// @access    Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  res.status(200).json({ success: true, data: {} });
});
