const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/" }),
  (req, res) => {
    // Issue JWT
    const token = jwt.sign(
      { id: req.user._id, name: req.user.displayName, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    // Send token to client (in real app, redirect with token or set cookie)
    res.json({ token });
  }
);

module.exports = router;
