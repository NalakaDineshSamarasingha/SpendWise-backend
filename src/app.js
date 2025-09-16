const express = require("express");
const passport = require("./config/passport");
const session = require("express-session");
const connectDB = require("./config/db");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

connectDB();

const app = express();
app.use(express.json());

app.use(
  session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", authRoutes);
app.use("/expenses", expenseRoutes);
app.use("/expenses", transactionRoutes);

app.get("/", (req, res) => res.send("Welcome to Expense Tracker API"));

module.exports = app;
