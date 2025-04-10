const express = require("express");
const mysql = require("mysql2/promise");
const router = express.Router();

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Middleware to validate user session
router.use((req, res, next) => {
  if (!req.session || !req.session.userId) {
    console.warn("Unauthorized access attempt detected.");
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please log in." });
  }
  next();
});

// Add a product to the cart
router.post("/", async (req, res) => {
  const userId = req.session.userId; // Retrieve user ID from session
  const { productId, buyer_id, offer_amount } = req.body;

  // Validate input
  if (!productId) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID ." });
  }

  try {
    const connection = await pool.getConnection();

    // Fetch product details from listings
    const [product] = await connection.query(
      "SELECT size, color, price, image_url FROM listings WHERE id = ?",
      [productId]
    );

    if (product.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const { size, color, price, image_url } = product[0];

    // Insert or update the cart
    const query = `
            INSERT INTO cart (user_id, product_id, size, color, price, image_url)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                size = VALUES(size),
                color = VALUES(color),
                price = VALUES(price),
                image_url = VALUES(image_url);
        `;
    await connection.query(query, [
      buyer_id ? buyer_id : userId,
      productId,
      size,
      color,
      offer_amount ? offer_amount : price,
      image_url,
    ]);
    connection.release();

    res.json({ success: true, message: "Product added to cart successfully." });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while adding product to cart.",
    });
  }
});

// Get all items in the user's cart
router.get("/", async (req, res) => {
  const userId = req.session.userId;
  console.log("Fetching cart items for user:", userId);

  try {
    const connection = await pool.getConnection();
    const query = `
            SELECT 
                c.id AS cart_id, 
                l.id AS product_id, 
                l.title, 
                c.size, 
                c.color, 
                c.image_url,  
                c.price
            FROM cart c
            JOIN listings l ON c.product_id = l.id
            WHERE c.user_id = ?;
        `;
    const [rows] = await connection.query(query, [userId]);
    connection.release();

    if (rows.length === 0) {
      console.log("Cart is empty for user:", userId);
      return res.json({ success: true, message: "Cart is empty.", data: [] });
    }

    res.json({
      success: true,
      message: "Cart fetched successfully.",
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching cart items.",
    });
  }
});

// Remove an item from the cart
router.delete("/:cartId", async (req, res) => {
  const cartId = req.params.cartId;

  if (!cartId) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid cart ID." });
  }

  try {
    const connection = await pool.getConnection();
    const query = "DELETE FROM cart WHERE id = ?;";
    const [result] = await connection.query(query, [cartId]);
    connection.release();

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Cart item not found." });
    }

    res.json({
      success: true,
      message: "Item removed from cart successfully.",
    });
  } catch (error) {
    console.error("Error removing cart item:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while removing cart item.",
    });
  }
});

router.post("/buy-again/:orderId", async (req, res) => {
  const userId = req.session.userId;
  const orderId = req.params.orderId;

  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please sign in." });
  }

  try {
    const connection = await pool.getConnection();

    // Fetch product details including `image_url`
    const [orderItems] = await connection.query(
      "SELECT oi.product_id, oi.price, oi.size, oi.image_url FROM order_items oi WHERE oi.order_id = ?",
      [orderId]
    );

    if (orderItems.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "No products found for this order." });
    }

    // Insert into cart with `image_url`
    for (let product of orderItems) {
      await connection.query(
        "INSERT INTO cart (user_id, product_id, price, size, image_url) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE price = VALUES(price), size = VALUES(size), image_url = VALUES(image_url)",
        [
          userId,
          product.product_id,
          product.price,
          product.size,
          product.image_url || "placeholder.jpg",
        ]
      );
    }

    connection.release();
    res.json({ success: true, message: "Products added to cart!" });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

module.exports = router;
