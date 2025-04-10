const express = require("express");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

dotenv.config();

const router = express.Router();

// Multer configuration

const storage = multer.memoryStorage();

const upload = multer({ storage });

// Cloudinary configuration

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,

  api_key: process.env.CLOUDINARY_API_KEY,

  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ✅ Fetch Products with Sorting and Filtering
router.get("/", async (req, res) => {
  const { sortBy, category, condition, gender, size } = req.query;

  let orderByClause = "ORDER BY created_at DESC"; // Default sorting: Newest

  if (sortBy === "priceAsc") {
    orderByClause = "ORDER BY price ASC"; // Price: Low to High
  } else if (sortBy === "priceDesc") {
    orderByClause = "ORDER BY price DESC"; // Price: High to Low
  }

  const filterConditions = ["status = 'Available'"];
  const params = [];

  if (category) {
    const categories = category.split(",");
    filterConditions.push(
      `category IN (${categories.map(() => "?").join(",")})`
    );
    params.push(...categories);
  }

  if (condition) {
    const conditionsArray = condition.split(",");
    filterConditions.push(
      `condition1 IN (${conditionsArray.map(() => "?").join(",")})`
    );
    params.push(...conditionsArray);
  }

  if (gender) {
    const genders = gender.split(",");
    filterConditions.push(`gender IN (${genders.map(() => "?").join(",")})`);
    params.push(...genders);
  }

  if (size) {
    const sizes = size.split(","); // Expecting comma-separated values

    filterConditions.push(`size IN (${sizes.map(() => "?").join(",")})`);

    params.push(...sizes);
  }

  // Construct the WHERE clause

  const whereClause = filterConditions.length
    ? `WHERE ${filterConditions.join(" AND ")} AND is_available = 1`
    : "";

  try {
    const query = `
      SELECT id, title, category, image_url, condition1, description, price, created_at, gender, material, color, size, status
      FROM listings
      ${whereClause}
      ${orderByClause};
    `;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(query, params);
    connection.release();
    // Send the response with filtered products
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// product-detail.js
router.get("/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const query = `
      SELECT id, title, category, image_url, image2_url, image3_url, condition1, description, price, size, gender, material, status, created_at
      FROM listings
      WHERE id = ?;
    `;
    const connection = await pool.getConnection();
    const [rows] = await connection.query(query, [productId]);
    connection.release();

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// make-offer route
router.post("/make-offer", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  const { product_id, offer_amount, offer_message } = req.body;
  const buyer_id = req.session.userId;

  try {
    const connection = await pool.getConnection();

    const [listing] = await connection.query(
      "SELECT sellerid FROM listings WHERE id = ?",
      [product_id]
    );

    if (listing.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Product not found." });
    }

    const seller_id = listing[0].sellerid;

    await connection.query(
      "INSERT INTO offers (product_id, buyer_id, seller_id, offer_amount, offer_message) VALUES (?, ?, ?, ?, ?)",
      [product_id, buyer_id, seller_id, offer_amount, offer_message || null]
    );

    connection.release();
    res.status(200).json({ message: "Offer submitted successfully!" });
  } catch (error) {
    console.error("Error submitting offer:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

module.exports = router;
