const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();
const router = express.Router();

// ✅ Database Connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ✅ Middleware to check if user is logged in
router.use(async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please log in." });
  }
  next();
});

// ✅ Get User Dashboard Data
router.get("/user-dashboard", async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    console.error("❌ User ID is missing from session!");
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please log in." });
  }

  try {
    const connection = await pool.getConnection();

    // ✅ Fetch username from database (if not already stored in session)
    let username = req.session?.username;
    if (!username) {
      const [userRow] = await connection.query(
        "SELECT username FROM user WHERE id = ?",
        [userId]
      );

      if (userRow.length > 0) {
        username = userRow[0].username;
        req.session.username = username; // ✅ Store username in session
      } else {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }
    }

    // ✅ Fetch other user stats
    const [totalSpentRow] = await connection.query(
      "SELECT COALESCE(SUM(total_price), 0) AS totalSpent FROM orders WHERE user_id = ? AND status = 'Delivered'",
      [userId]
    );
    const totalSpent = totalSpentRow[0]?.totalSpent || 0;

    const [ordersRow] = await connection.query(
      "SELECT COUNT(*) AS totalOrders FROM orders WHERE user_id = ?",
      [userId]
    );
    const totalOrders = ordersRow[0]?.totalOrders || 0;

    const [pendingOrdersRow] = await connection.query(
      "SELECT COUNT(*) AS pendingOrders FROM orders WHERE user_id = ? AND status = 'Pending'",
      [userId]
    );
    const pendingOrders = pendingOrdersRow[0]?.pendingOrders || 0;

    const avgOrderValue =
      totalOrders > 0 ? (totalSpent / totalOrders).toFixed(2) : "0.00";

    // ✅ Fetch Monthly Spending Data
    const [spendingData] = await connection.query(
      "SELECT DATE_FORMAT(order_date, '%Y-%m') AS month, SUM(total_price) AS total FROM orders WHERE user_id = ? GROUP BY month",
      [userId]
    );

    const months = spendingData.map((row) => row.month);
    const monthlySpending = spendingData.map((row) => row.total);

    connection.release();

    // ✅ Log Final API Response
    console.log("✅ API Response Sent:", {
      success: true,
      username, // ✅ Username is included
      totalSpent,
      totalOrders,
      pendingOrders,
      avgOrderValue,
      months,
      monthlySpending,
    });

    res.json({
      success: true,
      username,
      totalSpent,
      totalOrders,
      pendingOrders,
      avgOrderValue,
      months,
      monthlySpending,
    });
  } catch (error) {
    console.error("❌ Error fetching user dashboard data:", error);
    res
      .status(500)
      .json({ success: false, message: "Error loading dashboard." });
  }
});

// ✅ Check if Username Exists
router.get("/check-username", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res
      .status(400)
      .json({ success: false, message: "Username is required." });
  }

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT id FROM user WHERE username = ?",
      [username]
    );
    connection.release();

    if (rows.length > 0) {
      return res.json({ success: true, exists: true });
    } else {
      return res.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error("Error checking username:", error);
    res
      .status(500)
      .json({ success: false, message: "Error checking username." });
  }
});

// ✅ Get Username Only (For Display)
router.get("/get-username", async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please log in." });
  }

  try {
    const connection = await pool.getConnection();
    const [userRow] = await connection.query(
      "SELECT username FROM user WHERE id = ?",
      [userId]
    );
    connection.release();

    if (userRow.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const username = userRow[0].username;
    req.session.username = username; // ✅ Store username in session

    res.json({ success: true, username });
  } catch (error) {
    console.error("❌ Error fetching username:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching username." });
  }
});

// ✅ Get User Settings
router.get("/settings", async (req, res) => {
  const userId = req.session.userId;

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT username, email, first_name, last_name, phone, address, postal_code FROM user WHERE id = ?",
      [userId]
    );
    connection.release();

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching user settings." });
  }
});

// ✅ Password validation function
function isValidPassword(password) {
  return (
    password.length >= 6 &&
    /[A-Z]/.test(password) && // At least one uppercase
    /[0-9]/.test(password) && // At least one number
    /[\W_]/.test(password) // At least one special character
  );
}

// ✅ Update User Settings
router.put("/settings", async (req, res) => {
  const { userId } = req.session;
  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please log in." });
  }

  const {
    username,
    email,
    first_name,
    last_name,
    phone,
    address,
    postal_code,
    currentPassword,
    newPassword,
  } = req.body;

  try {
    const connection = await pool.getConnection();
    const [existingUser] = await connection.query(
      "SELECT * FROM user WHERE id = ?",
      [userId]
    );

    if (existingUser.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    let updateFields = {};
    let updateValues = [];

    if (username !== undefined) updateFields.username = username;
    if (email !== undefined) updateFields.email = email;
    if (first_name !== undefined) updateFields.first_name = first_name;
    if (last_name !== undefined) updateFields.last_name = last_name;
    if (phone !== undefined) updateFields.phone = phone;
    if (address !== undefined) updateFields.address = address;
    if (postal_code !== undefined) updateFields.postal_code = postal_code;

    // ✅ Check if username already exists
    if (username && username !== existingUser[0].username) {
      const [userCheck] = await connection.query(
        "SELECT id FROM user WHERE username = ?",
        [username]
      );
      if (userCheck.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: "Username already taken." });
      }
      updateFields.username = username;
    }

    // ✅ Check if email already exists
    if (email && email !== existingUser[0].email) {
      const [emailCheck] = await connection.query(
        "SELECT id FROM user WHERE email = ?",
        [email]
      );
      if (emailCheck.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: "Email already in use." });
      }
      updateFields.email = email;
    }

    // ✅ Handle password update
    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(
        currentPassword,
        existingUser[0].password
      );
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Current password is incorrect." });
      }

      if (!isValidPassword(newPassword)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters long, contain at least one uppercase letter, one number, and one special character.",
        });
      }

      updateFields.password = await bcrypt.hash(newPassword, 10);
    }

    // ✅ Perform the update
    await connection.query("UPDATE user SET ? WHERE id = ?", [
      updateFields,
      userId,
    ]);

    // ✅ Update session if username changed
    if (username) {
      req.session.username = username;
    }

    res.json({
      success: true,
      message: "Account settings updated successfully!",
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating settings.",
    });
  }
});

// ✅ Check if Username Exists
router.get("/check-username", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res
      .status(400)
      .json({ success: false, message: "Username is required." });
  }

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT id FROM user WHERE username = ?",
      [username]
    );
    connection.release();

    if (rows.length > 0) {
      return res.json({ success: true, exists: true });
    } else {
      return res.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error("Error checking username:", error);
    res
      .status(500)
      .json({ success: false, message: "Error checking username." });
  }
});

module.exports = router;
