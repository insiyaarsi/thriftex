const cron = require("node-cron");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Function to generate a random tracking number
const generateTrackingNumber = () => {
  return "TRK" + Math.floor(Math.random() * 1000000000);
};

// Function to update order status based on time intervals
const updateOrderStatus = async () => {
  try {
    const connection = await pool.getConnection();

    // Get orders that are still in progress and need updates
    const [orders] = await connection.query(`
            SELECT id, status, last_status_update 
            FROM orders 
            WHERE status IN ('Pending', 'Confirmed', 'In Progress') 
            AND TIMESTAMPDIFF(DAY, last_status_update, NOW()) >= 2
        `);

    for (const order of orders) {
      let newStatus;
      let trackingNumber = null;

      if (order.status === "Pending") {
        newStatus = "Confirmed";
      } else if (order.status === "Confirmed") {
        newStatus = "In Progress";
        trackingNumber = generateTrackingNumber(); // Assign tracking number
      } else if (order.status === "In Progress") {
        newStatus = "Completed";
      } else {
        continue;
      }

      // Update the order status in the database
      await connection.query(
        `
                UPDATE orders 
                SET status = ?, last_status_update = NOW(), tracking_number = ?
                WHERE id = ?`,
        [newStatus, trackingNumber, order.id]
      );

      console.log(
        `✅ Order ID ${order.id} updated to ${newStatus} with Tracking: ${
          trackingNumber || "N/A"
        }`
      );
    }

    connection.release();
  } catch (error) {
    console.error("❌ Error updating order statuses:", error);
  }
};

// Schedule the cron job to run every **minute** for testing
cron.schedule("* * * * *", updateOrderStatus, {
  scheduled: true,
  timezone: "Asia/Kolkata", // Adjust based on your timezone
});

console.log("🚀 Order status update scheduler is running.");
