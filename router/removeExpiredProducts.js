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

// ✅ Schedule a cron job to run every day at midnight
cron.schedule("0 0 * * *", async () => {
    console.log("Running daily cleanup for sold products...");

    try {
        const connection = await pool.getConnection();

        // ✅ Remove products marked as 'Sold' for more than 20 days
        const [result] = await connection.query(
            "DELETE FROM listings WHERE status = 'Sold' AND sold_at IS NOT NULL AND sold_at < NOW() - INTERVAL 20 DAY"
        );

        console.log(`Removed ${result.affectedRows} expired products.`);
        connection.release();
    } catch (error) {
        console.error("Error removing expired products:", error);
    }
});
