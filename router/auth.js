const express = require("express");
const passport = require("passport");
const dotenv = require("dotenv");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../config/db");

dotenv.config();

const router = express.Router();

// ✅ Google OAuth for Users
passport.use(
  "user-google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback/user", // ✅ Matches Google Console
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails[0].value;
        const username = profile.displayName;

        // Check if user already exists by Google ID
        const [existingGoogleUser] = await db.query(
          "SELECT * FROM user WHERE google_id = ?",
          [googleId]
        );

        if (existingGoogleUser.length > 0) {
          return done(null, existingGoogleUser[0]); // ✅ Return existing user
        }

        // Check if email exists but not linked to Google
        const [existingEmailUser] = await db.query(
          "SELECT * FROM user WHERE email = ?",
          [email]
        );

        if (existingEmailUser.length > 0) {
          await db.query("UPDATE user SET google_id = ? WHERE email = ?", [
            googleId,
            email,
          ]);
          return done(null, existingEmailUser[0]); // ✅ Return updated user
        }

        // Insert new Google user
        const [newUser] = await db.query(
          "INSERT INTO user (username, email, google_id) VALUES (?, ?, ?)",
          [username, email, googleId]
        );

        return done(null, {
          id: newUser.insertId,
          username,
          email,
          google_id: googleId,
        });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// ✅ Google OAuth for Sellers
passport.use(
  "seller-google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback/seller", // ✅ Matches Google Console
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails[0].value;
        const username = profile.displayName;

        // Check if seller already exists by Google ID
        const [existingGoogleSeller] = await db.query(
          "SELECT * FROM seller WHERE google_id = ?",
          [googleId]
        );

        if (existingGoogleSeller.length > 0) {
          return done(null, existingGoogleSeller[0]); // ✅ Return existing seller
        }

        // Check if email exists but not linked to Google
        const [existingEmailSeller] = await db.query(
          "SELECT * FROM seller WHERE email = ?",
          [email]
        );

        if (existingEmailSeller.length > 0) {
          await db.query("UPDATE seller SET google_id = ? WHERE email = ?", [
            googleId,
            email,
          ]);
          return done(null, existingEmailSeller[0]); // ✅ Return updated seller
        }

        // Insert new Google seller
        const [newSeller] = await db.query(
          "INSERT INTO seller (username, email, google_id) VALUES (?, ?, ?)",
          [username, email, googleId]
        );

        return done(null, {
          id: newSeller.insertId,
          username,
          email,
          google_id: googleId,
        });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// ✅ Serialize User (Handles Both Users and Sellers)
passport.serializeUser((user, done) => {
  done(null, { id: user.id, type: user.google_id ? "google" : "manual" });
});

// ✅ Deserialize User (Handles Both Users and Sellers)
passport.deserializeUser(async (obj, done) => {
  try {
    const { id } = obj;

    // Check in user table
    const [user] = await db.query("SELECT * FROM user WHERE id = ?", [id]);
    if (user.length > 0) return done(null, user[0]);

    // Check in seller table
    const [seller] = await db.query("SELECT * FROM seller WHERE id = ?", [id]);
    if (seller.length > 0) return done(null, seller[0]);

    return done(null, false);
  } catch (err) {
    done(err, null);
  }
});

// ✅ Routes for User Google Sign-In
router.get(
  "/google/user",
  passport.authenticate("user-google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback/user",
  passport.authenticate("user-google", { failureRedirect: "/login" }),
  (req, res) => {
    req.logIn(req.user, (err) => {
      if (err) return res.redirect("/login");
      req.session.userId = req.user.id;
      return res.redirect("/userHome.html"); // ✅ Redirects User to Home Page
    });
  }
);

// ✅ Routes for Seller Google Sign-In
router.get(
  "/google/seller",
  passport.authenticate("seller-google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback/seller",
  passport.authenticate("seller-google", { failureRedirect: "/login" }),
  (req, res) => {
    req.logIn(req.user, (err) => {
      if (err) return res.redirect("/login");
      req.session.sellerId = req.user.id;
      return res.redirect("/seller-dashboard.html"); // ✅ Redirects Seller to Dashboard
    });
  }
);

module.exports = router;
