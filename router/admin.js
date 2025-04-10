const express = require("express");
const router = express.Router();
const db = require("../config/db"); // Ensure correct path
const session = require("express-session");

// ✅ Admin Sign-In Route
router.post("/admin-signin", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Please enter both username and password." });
    }

    try {
        const query = "SELECT * FROM admin WHERE username = ?";
        const [rows] = await db.query(query, [username]);

        if (rows.length === 0) {
            console.log("❌ Admin username not found in database.");
            return res.status(404).json({ success: false, message: "Admin not found." });
        }

        const admin = rows[0];

        // ✅ Simple password check (Ensure passwords are not hashed)
        if (password.trim() !== admin.password.trim()) {
            console.log("❌ Password Mismatch Detected!");
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }

        // ✅ Store Admin Session
        req.session.adminId = admin.id;
        req.session.adminUsername = admin.username;  
        console.log("✅ Admin logged in successfully, session ID:", req.session.adminId);

        // ✅ Redirect Admin to Dashboard
        return res.json({
            success: true,
            message: "Admin authenticated successfully!",
            redirect: "/admin-dashboard.html" // ✅ Redirect Admin to Dashboard
        });

    } catch (err) {
        console.error("❌ Error during admin sign-in:", err);
        return res.status(500).json({ success: false, message: "An error occurred while signing in." });
    }
});

// ✅ Admin Logout Route
router.post("/admin-logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: "Error logging out." });
        }
        res.clearCookie("connect.sid");
        return res.json({ success: true, message: "Logged out successfully!" });
    });
});

// ✅ Admin Dashboard Route (Fixing `res.json` issue)
router.get("/admin-dashboard", async (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, message: "Unauthorized access." });
    }
    try {
        const [users] = await db.execute("SELECT COUNT(*) AS totalUsers FROM user");
        const [sellers] = await db.execute("SELECT COUNT(*) AS totalSellers FROM seller");
        const [availableProducts] = await db.execute("SELECT COUNT(*) AS totalAvailable FROM listings WHERE is_available = TRUE");
        const [totalRevenue] = await db.execute("SELECT IFNULL(SUM(amount), 0) AS totalRevenue FROM revenue");

        const adminUsername = req.session.adminUsername || "Admin";

        res.json({
            success: true,
            adminUsername,
            totalUsers: users[0].totalUsers,
            totalSellers: sellers[0].totalSellers,
            totalAvailable: availableProducts[0].totalAvailable,
            totalRevenue: parseFloat(totalRevenue[0].totalRevenue).toFixed(2)

        });
    } catch (error) {
        console.error("Error fetching admin data:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
// ✅ Fetch all users
router.get("/admin/users", async (req, res) => {
    try {
        // Fetch users from the 'user' table
        const [users] = await db.query("SELECT id, username, email FROM user");

        // Fetch sellers from the 'seller' table
        const [sellers] = await db.query("SELECT id, username, email FROM seller");

        // Add role field manually
        const userList = users.map(user => ({ ...user, role: "User" }));
        const sellerList = sellers.map(seller => ({ ...seller, role: "Seller" }));

        // Combine both lists
        const combinedList = [...userList, ...sellerList];

        // Send the combined response
        res.json(combinedList);
    } catch (error) {
        console.error("Error fetching users and sellers:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.delete("/admin/delete-user/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM user WHERE id = ?", [id]);
        res.json({ success: true, message: "User deleted successfully." });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

// ✅ DELETE Seller
router.delete("/admin/delete-seller/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM seller WHERE id = ?", [id]);
        res.json({ success: true, message: "Seller deleted successfully." });
    } catch (error) {
        console.error("Error deleting seller:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

// ✅ Fetch All Complaints (For Admin)
router.get("/complaints", async (req, res) => {
    try {
        const [complaints] = await db.query(`
            SELECT c.id, c.user_id, u.username, c.order_id, c.rating, c.complaint_text, c.status, c.image_url, c.created_at
            FROM complaints c
            JOIN user u ON c.user_id = u.id
            ORDER BY c.created_at DESC
        `);
        res.json({ success: true, complaints });
    } catch (error) {
        console.error("Error fetching complaints:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

// ✅ Update Complaint Status (Mark as Resolved)
router.patch("/complaints/:id", async (req, res) => {
    const complaintId = req.params.id;
    const { status } = req.body;

    if (!["Pending", "Resolved"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status." });
    }

    try {
        await db.query("UPDATE complaints SET status = ? WHERE id = ?", [status, complaintId]);
        res.json({ success: true, message: "Complaint status updated." });
    } catch (error) {
        console.error("Error updating complaint status:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

// ✅ Fetch All Orders (Admin)
router.get("/admin/orders", async (req, res) => {
    if (!req.session.adminId) {
        return res.status(403).json({ success: false, message: "Unauthorized: Admin access required." });
    }

    try {
        const [orders] = await db.query(`
            SELECT o.id AS order_id, u.username AS buyer_name, o.total_price, o.status, o.order_date
            FROM orders o
            JOIN user u ON o.user_id = u.id
            ORDER BY o.order_date DESC;
        `);

        if (orders.length === 0) {
            return res.json({ success: true, message: "No orders found.", orders: [] });
        }

        res.json({ success: true, orders });
    } catch (error) {
        console.error("Error fetching admin orders:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});


// ✅ Update Order Status
// ✅ Ensure only Admins can update order status
router.patch("/orders/:id", async (req, res) => {
    if (!req.session.adminId) {
        return res.status(403).json({ success: false, message: "Unauthorized: Admin access required." });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!["Pending", "Confirmed", "Shipped", "Completed", "Cancelled"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid order status." });
    }

    try {
        await db.query("UPDATE orders SET status = ?, last_update = NOW() WHERE id = ?", [status, id]);

        console.log(`✅ Order ID ${id} updated to ${status}`);
        res.json({ success: true, message: `Order updated to "${status}" successfully.` });

    } catch (error) {
        console.error("❌ Error updating order status:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});


router.get("/orders", async (req, res) => {
    if (!req.session.adminId) {
        return res.status(401).json({ success: false, message: "Unauthorized access." });
    }
    
    try {
        const [orders] = await db.query(`
            SELECT o.id AS order_id, u.username AS buyer, o.total_price, o.status, 
                   o.tracking_number, o.last_update 
            FROM orders o 
            JOIN user u ON o.user_id = u.id 
            ORDER BY o.last_update DESC
        `);

        if (orders.length === 0) {
            return res.json({ success: true, orders: [] });
        }

        const orderIds = orders.map(o => o.order_id);
        const [orderProducts] = await db.query(`
            SELECT oi.order_id, oi.product_id, oi.product_name, oi.image_url, oi.size, oi.price
            FROM order_items oi
            WHERE oi.order_id IN (?)
        `, [orderIds]);

        const groupedProducts = {};
        orderProducts.forEach(product => {
            if (!groupedProducts[product.order_id]) {
                groupedProducts[product.order_id] = [];
            }
            groupedProducts[product.order_id].push({
                product_id: product.product_id,
                product_name: product.product_name,
                image_url: product.image_url || "placeholder.jpg",
                size: product.size,
                price: product.price,
            });
        });

        const ordersWithProducts = orders.map(order => ({
            ...order,
            products: groupedProducts[order.order_id] || [],
        }));

        res.json({ success: true, orders: ordersWithProducts });

    } catch (error) {
        console.error("❌ Error fetching orders:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// ✅ Admin Updates Order Status
router.patch("/admin/orders/update-status/:id", async (req, res) => {
    if (!req.session.adminId) {
        return res.status(403).json({ success: false, message: "Unauthorized: Admin access required." });
    }

    const { id } = req.params;
    let { status } = req.body;

    console.log(`🔍 Received update request for Order ID: ${id} with status: '${status}'`);

    // Trim spaces and ensure correct casing
    status = status.trim();

    if (!["Pending", "Confirmed", "In Progress", "Completed", "Cancelled"].includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid order status: '${status}'` });
    }

    try {
        const [result] = await db.query("UPDATE orders SET status = ?, last_update = NOW() WHERE id = ?", [status, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        console.log(`✅ Order ID ${id} updated to '${status}'`);
        res.json({ success: true, message: `Order updated to "${status}" successfully.` });
    } catch (error) {
        console.error("❌ Error updating order status:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});


// ✅ Export the Router
module.exports = router;
