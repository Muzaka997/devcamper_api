const express = require("express");
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  upload,
  uploadUserPhoto,
  userPhotoUpload,
  submitTest,
  getSingleTest,
} = require("../controllers/users");

const User = require("../models/User");

const router = express.Router({ mergeParams: true });

const advancedResults = require("../middleware/advancedResults");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// Allow any authenticated user to upload their own profile photo
router.route("/:id/photo").put(upload, userPhotoUpload);

// Allow any authenticated user (any role) to submit tests
router.route("/:id/submit").post(submitTest);

// The routes below require elevated role
router.use(authorize("publisher"));

router.route("/").get(advancedResults(User), getUsers).post(createUser);

router.route("/:id").get(getUser).put(updateUser).delete(deleteUser);

// (kept above without role restriction)

router.route("/:id").get(protect, getSingleTest);

module.exports = router;
