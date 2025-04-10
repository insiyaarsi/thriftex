const express = require("express");
const router = express.Router();
const db = require("../config/db"); // Database connection

// Route to fetch featured products (publicly accessible)
router.get("/", async (req, res) => {
  try {
    const query = `
            SELECT id, title, category, image_url, condition1, price 
            FROM listings 
            WHERE is_available = 1 AND status = 'Available'
            LIMIT 6
        `;

    const [products] = await db.query(query);

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "No featured products found.",
      });
    }

    res.json({ success: true, featuredProducts: products });
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching featured products.",
    });
  }
});

module.exports = router;