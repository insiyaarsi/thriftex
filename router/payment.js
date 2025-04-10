const crypto = require("crypto");
const express = require("express");
const Razorpay = require("razorpay");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const router = express.Router();

// MySQL connection
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_ZwTctSYw0vO989",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "Z3YjrvUaa8Zaq9CQXgi6YN1F",
});

// ✅ Create Order API
router.post("/create-order", async (req, res) => {
    const userId = req.session.userId; // Ensure user is logged in

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
    }

    let connection;
    try {
        console.log("Fetching cart items for user:", userId);
        connection = await pool.getConnection();
        await connection.beginTransaction(); // Start transaction

        // Fetch items from cart
        const [cartItems] = await connection.query(
            `SELECT 
                c.product_id, 
                l.title AS product_name, 
                l.image_url AS listing_image_url, 
                c.size, 
                c.price 
            FROM cart c 
            JOIN listings l ON c.product_id = l.id 
            WHERE c.user_id = ?`,
            [userId]
        );

        if (cartItems.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ success: false, message: "Cart is empty." });
        }

        console.log("Cart items fetched:", cartItems);

        // Calculate total price
        // Calculate total price including platform charges
        const platformCharge = 50;
        const totalPrice = cartItems.reduce((total, item) => total + parseFloat(item.price || 0), 0) + platformCharge;

        console.log("Total price calculated:", totalPrice);

        // Insert new order into `orders` table
        const [orderResult] = await connection.query(
            "INSERT INTO orders (user_id, total_price) VALUES (?, ?)",
            [userId, totalPrice]
        );

        const orderId = orderResult.insertId;
        console.log("Order created with ID:", orderId);

        // Insert order items into `order_items` table
        for (const item of cartItems) {
            await connection.query(
                "INSERT INTO order_items (order_id, product_id, product_name, image_url, size, price) VALUES (?, ?, ?, ?, ?, ?)",
                [orderId, item.product_id, item.product_name, item.listing_image_url, item.size, item.price]
            );
        }

        console.log("Order items saved.");

        // ✅ Clear the cart after successful order placement
        await connection.query("DELETE FROM cart WHERE user_id = ?", [userId]);
        console.log("Cart cleared after successful order.");

        await connection.commit(); // Commit transaction
        connection.release();

        // ✅ Create a Razorpay order
        const options = {
            amount: totalPrice * 100, // Convert to paisa
            currency: "INR",
            receipt: `order_rcptid_${orderId}`,
            payment_capture: 1,
        };

        const order = await razorpay.orders.create(options);
        console.log("Razorpay order created:", order);

        res.json({ success: true, order_id: order.id, amount: order.amount });
    } catch (error) {
        if (connection) {
            await connection.rollback(); // Rollback transaction on error
            connection.release();
        }
        console.error("Error in create-order:", error);
        res.status(500).json({ success: false, message: "Error creating order." });
    }
});


// ✅ **Verify Razorpay Payment API**
router.post("/verify-payment", async (req, res) => {
    let connection;
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        req.body;
  
      console.log("Received payment verification request:", req.body);
  
      // 🔹 Ensure the crypto.createHmac function is available
      if (typeof crypto.createHmac !== "function") {
        console.error(
          "crypto.createHmac function is missing in your Node.js environment!"
        );
        return res.status(500).json({
          success: false,
          message: "Internal Server Error: Crypto module issue.",
        });
      }
  
      // ✅ Generate Expected Signature
      const secret =
        process.env.RAZORPAY_KEY_SECRET || "Z3YjrvUaa8Zaq9CQXgi6YN1F"; // Use actual secret key
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");
  
      console.log("Expected Signature:", expectedSignature);
      console.log("Received Signature:", razorpay_signature);
  
      // ✅ Compare the generated signature with the received one
      if (expectedSignature !== razorpay_signature) {
        console.error("Payment verification failed: Signature mismatch.");
        return res
          .status(400)
          .json({ success: false, message: "Payment verification failed." });
      }
  
      console.log("✅ Payment verified successfully!");
  
      connection = await pool.getConnection();
      await connection.beginTransaction();
  
      // ✅ Get the latest Order ID for the current user
      const [orderData] = await connection.query(
        "SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
        [req.session.userId]
      );
  
      if (orderData.length === 0) {
        await connection.rollback();
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Order not found." });
      }
  
      const orderId = orderData[0].id;
      console.log("Order ID:", orderId);
  
      // ✅ Fetch order items linked to this order
      const [orderItems] = await connection.query(
        "SELECT product_id FROM order_items WHERE order_id = ?",
        [orderId]
      );
  
      if (orderItems.length === 0) {
        await connection.rollback();
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "No products found for this order." });
      }
  
      console.log("Products in order:", orderItems);
  
      // ✅ Update each product's status to 'Sold' in listings table
      for (const item of orderItems) {
        await connection.query(
          "UPDATE listings SET status = 'Sold', sold_at = NOW() WHERE id = ?",
          [item.product_id]
        );
      }
  
      console.log("✅ Products marked as Sold in listings.");
  
      await connection.query(
        "INSERT INTO revenue (amount, order_id) VALUES (?, ?)",
        [50, orderId]
     );
    console.log("✅ ₹50 platform charge recorded in revenue table.");
      // ✅ Commit transaction and release connection
      await connection.commit();
      connection.release();
  
      res.json({
        success: true,
        message: "Payment verified and products marked as Sold!",
      });
    } catch (error) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }
      console.error("Error verifying payment:", error);
      res
        .status(500)
        .json({ success: false, message: "Error verifying payment." });
    }
  });



module.exports = router;
