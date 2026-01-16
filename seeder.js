const fs = require("fs");
const mongoose = require("mongoose");
const colors = require("colors");
const dotenv = require("dotenv");

// Load env vars
dotenv.config({ path: "./config/config.env" });

// Load models

const Course = require("./models/Course");
const User = require("./models/User");

const Book = require("./models/Book");
const Test = require("./models/Test");

// Connect to DB
mongoose.connect(process.env.MONGO_URI);

// Read JSON files

const courses = JSON.parse(
  fs.readFileSync(`${__dirname}/_data/courses.json`, "utf-8")
);

const users = JSON.parse(
  fs.readFileSync(`${__dirname}/_data/users.json`, "utf-8")
);

const books = JSON.parse(
  fs.readFileSync(`${__dirname}/_data/books.json`, "utf-8")
);

const tests = JSON.parse(
  fs.readFileSync(`${__dirname}/_data/tests.json`, "utf-8")
);

// Hash user passwords
// const hashUserPasswords = async (usersArray) => {
//   for (let user of usersArray) {
//     const salt = await bcrypt.genSalt(10);
//     user.password = await bcrypt.hash(user.password, salt);
//   }
//   return usersArray;
// };

// import into DB
const importData = async () => {
  try {
    await Course.create(courses);
    await User.create(users);
    await Book.create(books);
    await Test.create(tests);
    console.log(tests);
    console.log("Data Imported...".green.inverse);
    process.exit();
  } catch (err) {
    console.error(err);
  }
};

// Delete data
const deleteData = async () => {
  try {
    await Course.deleteMany();
    await User.deleteMany();
    await Test.deleteMany();
    await Book.deleteMany();
    console.log("Data Destroyed...".red.inverse);
    process.exit();
  } catch (err) {
    console.error(err);
  }
};

if (process.argv[2] === "-i") {
  importData();
} else if (process.argv[2] === "-d") {
  deleteData();
}
