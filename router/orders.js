const express = require("express");
const mysql = require("mysql2/promise");
const router = express.Router();
const dotenv = require("dotenv");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

dotenv.config();

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "thriftex/complaints",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: (req, file) => `complaint_${Date.now()}`,
  },
});

const upload = multer({ storage });


// ✅ Middleware to validate user session
router.use((req, res, next) => {
  if (!req.session || (!req.session.userId && !req.session.sellerId)) {
    return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
  }
  next();
});

// ✅ Get all orders for the logged-in buyer
router.get("/", async (req, res) => {
  const userId = req.session.userId;
  const { timePeriod } = req.query;

  let dateCondition = "";
  if (timePeriod === "week") {
    dateCondition = "AND o.order_date >= NOW() - INTERVAL 1 WEEK";
  } else if (timePeriod === "month") {
    dateCondition = "AND o.order_date >= NOW() - INTERVAL 1 MONTH";
  } else if (timePeriod === "2024") {
    dateCondition = "AND YEAR(o.order_date) = 2024";
  }

  try {
    const connection = await pool.getConnection();
    const query = `
    SELECT o.id AS order_id, o.total_price, o.order_date, o.status, o.tracking_number,o.last_update,
           oi.product_id, oi.product_name, oi.image_url, oi.size, oi.price
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = ? ${dateCondition}
    ORDER BY o.order_date DESC;
`;

const [orders] = await connection.query(query, [userId]);
    connection.release();

    if (orders.length === 0) {
      return res.json({
        success: true,
        message: "No orders found.",
        orders: [],
      });
    }

    // Group products under each order
    const groupedOrders = {};
    orders.forEach((order) => {
      if (!groupedOrders[order.order_id]) {
        groupedOrders[order.order_id] = {
          order_id: order.order_id,
          total_price: order.total_price,
          order_date: order.order_date,
          status: order.status,
          tracking_number: order.tracking_number,
          last_update: order.last_update,
          products: [],
        };
      }
      groupedOrders[order.order_id].products.push({
        product_id: order.product_id,
        product_name: order.product_name,
        image_url: order.image_url,
        size: order.size,
        price: order.price,
      });
    });

    // console.log("Orders Data:", orders); // Verify sorting at backend

    res.json({ success: true, orders: Object.values(groupedOrders) });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching orders.",
    });
  }
});



// ✅ Fetch Orders for Seller (Products they sold)
router.get("/seller", async (req, res) => {
  const sellerId = req.session.sellerId;
  console.log("Logged-in seller ID:", req.session.sellerId);


  if (!sellerId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please sign in." });
  }

  try {
    const connection = await pool.getConnection();

    const query = `
            SELECT o.id AS order_id, u.username AS buyer_name, o.total_price, o.status, o.order_date
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN user u ON o.user_id = u.id
            WHERE oi.product_id IN (SELECT id FROM listings WHERE sellerid = ?)
            GROUP BY o.id
            ORDER BY o.order_date DESC;
        `;

    const [orders] = await connection.query(query, [sellerId]);
    connection.release();

    if (orders.length === 0) {
      return res.json({
        success: true,
        message: "No orders found.",
        orders: [],
      });
    }

    res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching seller orders:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// ✅ Update Order Status (Seller updates)
router.patch("/update-status/:orderId", async (req, res) => {
  const sellerId = req.session.sellerId;
  const { status } = req.body;
  const orderId = req.params.orderId;

  if (!sellerId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized. Please sign in." });
  }

  if (
    !["Confirmed", "In Progress", "Completed", "Cancelled"].includes(status)
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status update." });
  }

  try {
    const connection = await pool.getConnection();

    // Ensure the order belongs to the seller
    const [orderCheck] = await connection.query(
      `SELECT COUNT(*) AS count FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = ? AND oi.product_id IN (SELECT id FROM listings WHERE sellerid = ?);`,
      [orderId, sellerId]
    );

    if (orderCheck[0].count === 0) {
      connection.release();
      return res.status(403).json({
        success: false,
        message: "Unauthorized to update this order.",
      });
    }

    await connection.query(`UPDATE orders SET status = ? WHERE id = ?`, [
      status,
      orderId,
    ]);
    connection.release();

    res.json({
      success: true,
      message: `Order status updated to "${status}" successfully.`,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Route to fetch user dashboard data

router.get("/user-dashboard", async (req, res) => {
  const userId = req.session.userId; // Ensure user is authenticated

  try {
    const connection = await pool.getConnection();

    // Total Purchases
    const [totalPurchases] = await connection.query(
      `SELECT SUM(total_price) AS total_purchases 
         FROM orders 
         WHERE user_id = ? AND status IN ('Pending', 'Completed');`,
      [userId]
    );

    // Total Orders
    const [totalOrders] = await connection.query(
      `SELECT COUNT(*) AS total_orders 
         FROM orders 
         WHERE user_id = ?;`,
      [userId]
    );

    // Pending Orders
    const [pendingOrders] = await connection.query(
      `SELECT COUNT(*) AS pending_orders 
         FROM orders 
         WHERE user_id = ? AND status = 'Pending';`,
      [userId]
    );

    // Average Order Value
    const [avgOrderValue] = await connection.query(
      `SELECT AVG(total_price) AS avg_order_value 
         FROM orders 
         WHERE user_id = ? AND status IN ('Pending', 'Completed');`,
      [userId]
    );

    // Monthly Spending Data
    const [monthlySpendingData] = await connection.query(
      `SELECT DATE_FORMAT(order_date, '%Y-%m') AS month, 
                SUM(total_price) AS total_spending
         FROM orders 
         WHERE user_id = ? AND status IN ('Pending', 'Completed')
         GROUP BY month
         ORDER BY month;`,
      [userId]
    );

    // Formatting Monthly Spending for Frontend
    const months = monthlySpendingData.map((entry) => entry.month);
    const spendingValues = monthlySpendingData.map(
      (entry) => entry.total_spending
    );

    res.json({
      success: true,
      totalSpent: totalPurchases[0].total_purchases || 0,
      totalOrders: totalOrders[0].total_orders || 0,
      pendingOrders: pendingOrders[0].pending_orders || 0,
      avgOrderValue: avgOrderValue[0].avg_order_value || 0,
      months,
      monthlySpending: spendingValues,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Failed to retrieve dashboard data" });
  }
});



// ✅ Cancel Order and Update Listings Table
router.patch("/cancel/:orderId", async (req, res) => {
  const userId = req.session.userId;
  const orderId = req.params.orderId;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized. Please sign in." });
  }

  try {
    const connection = await pool.getConnection();

    // Check order status
    const [order] = await connection.query(
      "SELECT status FROM orders WHERE id = ? AND user_id = ?",
      [orderId, userId]
    );

    if (order.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order[0].status === "Completed") {
      connection.release();
      return res.status(400).json({ success: false, message: "Completed orders cannot be cancelled." });
    }

    // Retrieve product IDs from the order
    const [orderedProducts] = await connection.query(
      "SELECT product_id FROM order_items WHERE order_id = ?",
      [orderId]
    );

    if (orderedProducts.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: "No products found for this order." });
    }

    // Update order status to "Cancelled"
    await connection.query(
      "UPDATE orders SET status = 'Cancelled', last_status_update = NOW() WHERE id = ?",
      [orderId]
    );

    // Update product availability in listings
    for (let product of orderedProducts) {
      await connection.query(
        "UPDATE listings SET status = 'Available' WHERE id = ?",
        [product.product_id]
      );
    }

    connection.release();
    res.json({ success: true, message: "Order cancelled successfully, and products are now available again." });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

router.post("/cart/buy-again/:orderId", async (req, res) => {
  const userId = req.session.userId;
  const orderId = req.params.orderId;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized. Please sign in." });
  }

  try {
    const connection = await pool.getConnection();

    // Fetch products from the cancelled order
    const [orderItems] = await connection.query(
      "SELECT product_id, price, size FROM order_items WHERE order_id = ?",
      [orderId]
    );

    if (orderItems.length === 0) {
      connection.release();
      return res.status(404).json({ success: false, message: "No products found for this order." });
    }

    // Add products to cart (without quantity column)
    for (let product of orderItems) {
      await connection.query(
        "INSERT INTO order_items (order_id, product_id, product_name, price, size, image_url) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, productId, productName, price, size, imageUrl]
      );      
    }

    connection.release();
    res.json({ success: true, message: "Products added to cart!" });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// ✅ Route to delete an order
router.delete("/delete/:orderId", async (req, res) => {
  const userId = req.session.userId;
  const orderId = req.params.orderId;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized. Please sign in." });
  }

  try {
    const connection = await pool.getConnection();

    // Ensure the order belongs to the user and is cancelled
    const [order] = await connection.query(
      "SELECT id FROM orders WHERE id = ? AND user_id = ? AND status = 'Cancelled'",
      [orderId, userId]
    );

    if (order.length === 0) {
      connection.release();
      return res.status(403).json({ success: false, message: "You can only delete cancelled orders." });
    }

    // Delete order and related items
    await connection.query("DELETE FROM order_items WHERE order_id = ?", [orderId]);
    await connection.query("DELETE FROM orders WHERE id = ?", [orderId]);

    connection.release();
    res.json({ success: true, message: "Order deleted successfully." });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// ✅ Submit a Complaint
router.post("/complaints", upload.single("image"), async (req, res) => {
  const userId = req.session.userId;
  const { orderId, rating, complaintText } = req.body;

  if (!orderId || rating === undefined || rating === null || complaintText.trim() === "") {
    return res.status(400).json({ success: false, message: "All fields except image are required." });
  }
  

  const imageUrl = req.file ? req.file.path : null;

  try {
      const connection = await pool.getConnection();
      await connection.query(
          "INSERT INTO complaints (user_id, order_id, rating, complaint_text,image_url) VALUES (?, ?, ?, ?,?)",
          [userId, orderId, rating, complaintText, imageUrl]
      );
      connection.release();
      res.json({ success: true, message: "Complaint submitted successfully." });
  } catch (error) {
      console.error("Error submitting complaint:", error);
      res.status(500).json({ success: false, message: "Internal server error." });
  }
});

router.patch("/cancel/:orderId", async (req, res) => {
  const userId = req.session.userId;
  const orderId = req.params.orderId;

  if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized. Please sign in." });
  }

  try {
      const connection = await pool.getConnection();

      // ✅ Check if the order belongs to the user and is Pending or Confirmed
      const [order] = await connection.query(
          "SELECT status FROM orders WHERE id = ? AND user_id = ?",
          [orderId, userId]
      );

      if (order.length === 0) {
          connection.release();
          return res.status(404).json({ success: false, message: "Order not found." });
      }

      if (!["Pending", "Confirmed"].includes(order[0].status)) {
          connection.release();
          return res.status(400).json({ success: false, message: "Only Pending and Confirmed orders can be cancelled." });
      }

      // ✅ Update order status to "Cancelled"
      await connection.query(
          "UPDATE orders SET status = 'Cancelled', last_update = NOW() WHERE id = ?",
          [orderId]
      );

      connection.release();
      res.json({ success: true, message: "Order cancelled successfully." });
  } catch (error) {
      console.error("Error cancelling order:", error);
      res.status(500).json({ success: false, message: "Internal server error." });
  }
});



module.exports = router;
