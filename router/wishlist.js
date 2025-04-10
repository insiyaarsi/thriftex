const express = require("express");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const router = express.Router();

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ✅ Add Product to Wishlist
router.post("/add", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }
  console.log("Wishlist POST request received:", req.body);
  let { product_id, size, color, image_url, price } = req.body;
  const user_id = req.session.userId;

  size = size || "M"; // Default size
  color = color || "Black"; // Default color

  try {
    const connection = await pool.getConnection();

    const [existing] = await connection.query(
      "SELECT * FROM wishlist WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?",
      [user_id, product_id, size, color]
    );

    if (existing.length > 0) {
      connection.release();
      return res.json({ message: "Product already in wishlist." });
    }

    await connection.query(
      "INSERT INTO wishlist (user_id, product_id, size, color, image_url, price) VALUES (?, ?, ?, ?, ?, ?)",
      [user_id, product_id, size, color, image_url, price]
    );

    connection.release();
    res.json({ message: "Product added to wishlist successfully!" });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// ✅ Fetch Wishlist Items
router.get("/", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }
  const user_id = req.session.userId;
  try {
    const connection = await pool.getConnection();
    const [wishlistItems] = await connection.query(
      `SELECT w.id AS wishlist_id, w.product_id, l.title,l.status, w.image_url, w.size, w.color, w.price
       FROM wishlist w 
       JOIN listings l ON w.product_id = l.id 
       WHERE w.user_id = ?`,
      [user_id]
    );
    connection.release();
    res.json({ success: true, data: wishlistItems });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// ✅ Remove Item from Wishlist
router.delete("/remove/:id", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  const wishlist_id = req.params.id;
  const user_id = req.session.userId;

  try {
    const connection = await pool.getConnection();

    await connection.query(
      "DELETE FROM wishlist WHERE id = ? AND user_id = ?",
      [wishlist_id, user_id]
    );

    connection.release();
    res.json({ message: "Product removed from wishlist." });
  } catch (error) {
    console.error("Error removing wishlist item:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
