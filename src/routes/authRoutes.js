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
    // Redirect to frontend with token in URL
    console.log("Fallback receive");
    const redirectUrl = req.query.redirect_uri || "http://localhost:8081"; // fallback to Expo dev URL
    console.log(redirectUrl);
    res.redirect(`${redirectUrl}?token=${token}`);
  }
);

module.exports = router;
