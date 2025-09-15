const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const router = express.Router();

/**
 * Step 1: Start Google login
 * Save the frontend redirect_uri inside the OAuth "state" parameter
 */
router.get("/google", (req, res, next) => {
  const redirectUri = req.query.redirect_uri; // comes from Expo app
  const state = encodeURIComponent(redirectUri || "");

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state,
  })(req, res, next);
});

/**
 * Step 2: Handle Google callback
 * Exchange user info -> issue JWT -> redirect back to Expo app with ?token=...
 */
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/" }),
  (req, res) => {
    // Create JWT with your app secret
    const token = jwt.sign(
      { id: req.user._id, name: req.user.displayName, email: req.user.email,picture: req.user.picture  },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Retrieve redirect_uri from state
    const redirectUrl = req.query.state
      ? decodeURIComponent(req.query.state)
      : "http://localhost:8081"; // fallback for Expo dev client

    // Redirect user back to Expo app with token
    res.redirect(`${redirectUrl}?token=${token}`);
  }
);

module.exports = router;
