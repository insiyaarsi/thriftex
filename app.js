const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const passport = require("passport");

// Routers
const listingsRouter = require("./router/listings");
const productsRouter = require("./router/products");
const cartRouter = require("./router/cart");
const wishlistRouter = require("./router/wishlist");
const paymentRouter = require("./router/payment.js");
const ordersRouter = require("./router/orders");
const offerRoutes = require("./router/offers");
const userRoutes = require("./router/user");
const adminRoutes = require("./router/admin");
const authRoutes = require("./router/auth");
const featuredProductsRouter = require("./router/featuredProducts");

dotenv.config();

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.static("router"));

// CORS Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_fallback_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false,
      maxAge: 60 * 60 * 1000     // ✅ 1 hour of inactivity (in milliseconds)
      },
      rolling: true // Reset cookie expiration on each request
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Database Connection
const db = require("./config/db");

// Test database connection
(async () => {
  try {
    await db.query("SELECT 1");
    console.log("✅ Database connection tested successfully!");
  } catch (err) {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  }
})();

// Middleware to ensure authentication
function ensureUserLoggedIn(req, res, next) {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please log in." });
  }
  next();
}

function ensureSellerLoggedIn(req, res, next) {
  if (!req.session.sellerId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please sign in." });
  }
  next();
}

// ✅ User Signup
app.post("/api/users/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Please fill in all fields." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query =
      "INSERT INTO user (username, email, password) VALUES (?, ?, ?)";
    const [result] = await db.query(query, [username, email, hashedPassword]);

    if (result.affectedRows > 0) {
      return res.json({
        success: true,
        message: "User registered successfully!",
      });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "User registration failed." });
    }
  } catch (err) {
    console.error("❌ Error inserting user:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while registering the user.",
      });
  }
});

// ✅ Seller Signup
app.post("/api/sellers/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Please fill in all fields." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query =
      "INSERT INTO seller (username, email, password) VALUES (?, ?, ?)";
    const [result] = await db.query(query, [username, email, hashedPassword]);

    if (result.affectedRows > 0) {
      return res.json({
        success: true,
        message: "Seller registered successfully!",
      });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Seller registration failed." });
    }
  } catch (err) {
    console.error("❌ Error inserting seller:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while registering the seller.",
      });
  }
});

// ✅ User Sign-in
app.post("/api/users/signin", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Please provide both username and password.",
      });
  }

  try {
    const [rows] = await db.query("SELECT * FROM user WHERE username = ?", [
      username,
    ]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    req.session.userId = user.id;
    return res.json({
      success: true,
      message: "User authenticated successfully!",
      redirect: "/userHome.html",
    });
  } catch (err) {
    console.error("❌ Error during user sign-in:", err);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred while signing in." });
  }
});

// ✅ Seller Sign-in
app.post("/api/sellers/signin", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Please provide both username and password.",
      });
  }

  try {
    const [rows] = await db.query("SELECT * FROM seller WHERE username = ?", [
      username,
    ]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Seller not found." });
    }

    const seller = rows[0];
    const isPasswordValid = await bcrypt.compare(password, seller.password);

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    req.session.sellerId = seller.id;
    return res.json({
      success: true,
      message: "Seller authenticated successfully!",
      redirect: "/seller-dashboard.html",
    });
  } catch (err) {
    console.error("❌ Error during seller sign-in:", err);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred while signing in." });
  }
});

// ✅ Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Error during session destruction:", err);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while logging out.",
        });
    }
    res.clearCookie("connect.sid");
    return res.json({ success: true, message: "Logged out successfully!" });
  });
});

// Protected Routes
app.use("/api/listings", ensureSellerLoggedIn, listingsRouter);
app.use("/api/products", productsRouter);
app.use("/api/cart", ensureUserLoggedIn, cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api", paymentRouter);
app.use("/api/orders", ordersRouter);
app.use("/offers", offerRoutes);
app.use("/user", userRoutes);
app.use("/api", adminRoutes);
app.use("/auth", authRoutes);
app.use("/api/featured-products", featuredProductsRouter);

// ✅ Home Route
app.get("/", (req, res) => {
  res.send("ThriftEx API is running!");
});

// ✅ Handle 404 Errors
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
