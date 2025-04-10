const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // Import database connection

// Middleware to check if seller is authenticated
const authenticateSeller = (req, res, next) => {
  if (!req.session.sellerId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized access" });
  }
  next();
};

// Middleware to check if buyer is authenticated

const authenticateBuyer = (req, res, next) => {
  if (!req.session.userId) {
    return res

      .status(401)

      .json({ success: false, message: "Unauthorized access" });
  }

  next();
};

function authenticateUser(req, res, next) {
  if (req.session.userId || req.session.sellerId) {
    next(); // Proceed if either a user or a seller is logged in
  } else {
    return res

      .status(401)

      .json({ success: false, message: "Unauthorized. Please log in." });
  }
}

// Example route
router.get("/", (req, res) => {
  res.send("Offers API is working");
});

/**
 * GET /offers/seller
 * Fetch all offers related to the seller's listings
 */
router.get("/seller", authenticateSeller, async (req, res) => {
  const sellerId = req.session.sellerId;

  try {
    const query = `
      SELECT offers.id, user.username AS buyer_username, listings.title, listings.category, 
             offers.offer_amount, offers.status, offers.last_updated_by, offers.offer_message, listings.image_url
      FROM offers 
      JOIN listings ON offers.product_id = listings.id 
      JOIN user ON offers.buyer_id = user.id
      WHERE offers.seller_id = ?
      ORDER BY offers.created_at DESC
    `;

    const connection = await pool.getConnection();
    const [offers] = await connection.query(query, [sellerId]);
    connection.release();

    // Categorize offers into "New Offers" and "Ongoing Offers"
    const newOffers = offers.filter(
      (offer) => offer.status === "Pending" && offer.last_updated_by === "buyer"
    );
    const ongoingOffers = offers.filter(
      (offer) =>
        offer.status === "Pending" && offer.last_updated_by === "seller"
    );

    res.json({ success: true, newOffers, ongoingOffers });
  } catch (error) {
    console.error("Error fetching seller offers:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * PATCH /offers/accept/:offerId
 * Accept an offer and mark the product as 'Sold'
 */
router.patch("/accept/:offerId", authenticateUser, async (req, res) => {
  const { offerId } = req.params;
  const userId = req.session.userId;
  const sellerId = req.session.sellerId;

  let connection;

  try {
    connection = await pool.getConnection();

    // Fetch offer details
    const [offer] = await connection.query(
      `SELECT buyer_id, seller_id, product_id, offer_amount, last_updated_by 
       FROM offers WHERE id = ? AND status = 'Pending'`,
      [offerId]
    );

    if (offer.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Offer not found or already updated.",
      });
    }

    const { buyer_id, seller_id, product_id, offer_amount, last_updated_by } =
      offer[0];

    // Fetch product details from listings
    const [productDetails] = await connection.query(
      `SELECT size, color, image_url FROM listings WHERE id = ?`,
      [product_id]
    );

    if (productDetails.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Product details not found.",
      });
    }

    const { size, color, image_url } = productDetails[0];

    if (sellerId && sellerId === seller_id && last_updated_by === "buyer") {
      // Seller accepting buyer's initial or counteroffer
      await connection.query(
        `UPDATE offers SET status = 'Accepted' WHERE id = ? AND status = 'Pending'`,
        [offerId]
      );

      // // Mark listing as sold
      // await connection.query(
      //   `UPDATE listings SET status = 'Sold' WHERE id = ?`,
      //   [product_id]
      // );

      // Add product to buyer's cart with agreed price and product details
      await connection.query(
        `INSERT INTO cart (user_id, product_id, price, size, color, image_url) 
    VALUES (?, ?, ?, ?, ?, ?) 
    ON DUPLICATE KEY UPDATE 
        price = VALUES(price), 
        size = VALUES(size), 
        color = VALUES(color), 
        image_url = VALUES(image_url)`,
        [buyer_id, product_id, offer_amount, size, color, image_url]
      );

      res.json({
        success: true,
        message:
          "Seller accepted the offer. Listing marked as sold. Product added to cart.",
      });
    } else if (userId && userId === buyer_id && last_updated_by === "seller") {
      // Buyer accepting seller's counteroffer
      await connection.query(
        `UPDATE offers SET status = 'Accepted' WHERE id = ? AND status = 'Pending'`,
        [offerId]
      );

      // // Mark listing as sold
      // await connection.query(
      //   `UPDATE listings SET status = 'Sold' WHERE id = ?`,
      //   [product_id]
      // );

      // Add product to buyer's cart with agreed price and product details
      await connection.query(
        `INSERT INTO cart (user_id, product_id, price, size, color, image_url) 
    VALUES (?, ?, ?, ?, ?, ?) 
    ON DUPLICATE KEY UPDATE 
        price = VALUES(price), 
        size = VALUES(size), 
        color = VALUES(color), 
        image_url = VALUES(image_url)`,
        [buyer_id, product_id, offer_amount, size, color, image_url]
      );

      res.json({
        success: true,
        message:
          "Buyer accepted the seller's counteroffer. Listing marked as sold. Product added to cart.",
      });
    } else {
      res.status(403).json({
        success: false,
        message: "Unauthorized action.",
      });
    }

    connection.release();
  } catch (error) {
    console.error("Error accepting offer:", error);
    if (connection) connection.release();
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * PATCH /offers/reject/:offerId
 * Reject an offer
 */
router.patch("/reject/:offerId", authenticateUser, async (req, res) => {
  const { offerId } = req.params;
  const userId = req.session.userId;
  const sellerId = req.session.sellerId;

  try {
    const connection = await pool.getConnection();

    // Fetch offer details
    const [offer] = await connection.query(
      `SELECT buyer_id, seller_id, last_updated_by 
       FROM offers WHERE id = ? AND status = 'Pending'`,
      [offerId]
    );

    if (offer.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: "Offer not found or already updated.",
      });
    }

    const { buyer_id, seller_id, last_updated_by } = offer[0];

    if (sellerId && sellerId === seller_id && last_updated_by === "buyer") {
      // Seller rejecting buyer's initial or counteroffer
      await connection.query(
        `UPDATE offers SET status = 'Declined' WHERE id = ? AND status = 'Pending'`,
        [offerId]
      );

      res.json({ success: true, message: "Seller rejected the offer." });
    } else if (userId && userId === buyer_id && last_updated_by === "seller") {
      // Buyer rejecting seller's counteroffer
      await connection.query(
        `UPDATE offers SET status = 'Declined' WHERE id = ? AND status = 'Pending'`,
        [offerId]
      );

      res.json({
        success: true,
        message: "Buyer rejected the seller's counteroffer.",
      });
    } else {
      res.status(403).json({
        success: false,
        message: "Unauthorized action.",
      });
    }

    connection.release();
  } catch (error) {
    console.error("Error rejecting offer:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * POST /offers/counter/:offerId
 * Send a counteroffer with a new amount and optional message
 */
router.post("/counter/:offerId", authenticateUser, async (req, res) => {
  const { offerId } = req.params;
  const { counterAmount, message } = req.body;
  const userId = req.session.userId;
  const sellerId = req.session.sellerId;

  if (!counterAmount || isNaN(counterAmount) || counterAmount <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid counter amount." });
  }

  try {
    const connection = await pool.getConnection();

    // Fetch offer details
    const [offer] = await connection.query(
      `SELECT offers.buyer_id, offers.seller_id, listings.price, offers.last_updated_by 
       FROM offers 
       JOIN listings ON offers.product_id = listings.id 
       WHERE offers.id = ? AND offers.status = 'Pending'`,
      [offerId]
    );

    if (offer.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "Offer not found." });
    }

    const { buyer_id, seller_id, price, last_updated_by } = offer[0];

    if (sellerId && sellerId === seller_id && last_updated_by === "buyer") {
      // Seller making a counteroffer to the buyer
      if (counterAmount >= price) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Counteroffer must be lower than the original listing price of ₹${price.toFixed(
            2
          )}.`,
        });
      }

      await connection.query(
        `UPDATE offers 
         SET offer_amount = ?, status = 'Pending', offer_message = ?, last_updated_by = 'seller' 
         WHERE id = ? AND status = 'Pending'`,
        [counterAmount, message, offerId]
      );

      res.json({
        success: true,
        message: "Seller counteroffer sent successfully.",
      });
    } else if (userId && userId === buyer_id && last_updated_by === "seller") {
      // Buyer making a counteroffer to the seller
      if (counterAmount >= price) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Counteroffer must be lower than the original listing price of ₹${price.toFixed(
            2
          )}.`,
        });
      }

      await connection.query(
        `UPDATE offers 
         SET offer_amount = ?, status = 'Pending', offer_message = ?, last_updated_by = 'buyer' 
         WHERE id = ? AND status = 'Pending'`,
        [counterAmount, message, offerId]
      );

      res.json({
        success: true,
        message: "Buyer counteroffer sent successfully.",
      });
    } else {
      res.status(403).json({
        success: false,
        message: "Unauthorized action.",
      });
    }

    connection.release();
  } catch (error) {
    console.error("Error sending counteroffer:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * GET /offers/original-price/:offerId
 * Fetch the original listing price for the given offer ID
 */
router.get("/original-price/:offerId", authenticateUser, async (req, res) => {
  const { offerId } = req.params;
  const userId = req.session.userId;
  const sellerId = req.session.sellerId;

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT listings.price, offers.buyer_id, offers.seller_id 
       FROM listings 
       JOIN offers ON listings.id = offers.product_id 
       WHERE offers.id = ?`,
      [offerId]
    );

    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Listing price not found.",
      });
    }

    const { price, buyer_id, seller_id } = rows[0];

    // Ensure only the buyer or seller involved in the offer can access the price
    if (
      (sellerId && sellerId === seller_id) ||
      (userId && userId === buyer_id)
    ) {
      return res.json({ success: true, originalPrice: price });
    } else {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access.",
      });
    }
  } catch (error) {
    console.error("Error fetching original price:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * GET /offers/buyer
 * Fetch all offers related to the logged-in buyer
 */
router.get("/buyer", authenticateBuyer, async (req, res) => {
  const buyerId = req.session.userId; // Assuming session stores user ID
  try {
    const query = `
      SELECT offers.id, listings.title, listings.category, offers.offer_amount, 
             offers.status, offers.last_updated_by, offers.offer_message, seller.username AS seller_username, listings.image_url 
      FROM offers
      JOIN listings ON offers.product_id = listings.id
      JOIN seller ON listings.sellerid = seller.id  -- Fetch seller's username
      WHERE offers.buyer_id = ?
      ORDER BY offers.created_at DESC
    `;

    const connection = await pool.getConnection();
    const [offers] = await connection.query(query, [buyerId]);
    connection.release();

    const ongoingOffersBuyer = offers.filter(
      (offer) =>
        offer.status === "Pending" && offer.last_updated_by === "seller"
    );
    const pendingOffers = offers.filter(
      (offer) => offer.status === "Pending" && offer.last_updated_by === "buyer"
    );

    res.json({ success: true, ongoingOffersBuyer, pendingOffers });
  } catch (error) {
    console.error("Error fetching buyer offers:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

/**
 * PATCH /offers/respond/:offerId
 * Buyer responds to a seller's counteroffer
 */
router.patch("/respond/:offerId", async (req, res) => {
  const buyerId = req.session.userId;
  const { offerId } = req.params;
  const { action, counterAmount, message } = req.body;

  if (!buyerId) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized access" });
  }

  try {
    const connection = await pool.getConnection();

    if (action === "accept") {
      const query = `UPDATE offers SET status = 'Accepted' WHERE id = ? AND buyer_id = ?`;
      await connection.query(query, [offerId, buyerId]);
      await connection.query(
        `UPDATE listings SET status = 'Sold' WHERE id = (SELECT product_id FROM offers WHERE id = ?)`,
        [offerId]
      );
    } else if (action === "reject") {
      const query = `UPDATE offers SET status = 'Declined' WHERE id = ? AND buyer_id = ?`;
      await connection.query(query, [offerId, buyerId]);
    } else if (action === "counter" && counterAmount > 0) {
      const query = `
        UPDATE offers 
        SET offer_amount = ?, status = 'Pending', offer_message = ?, last_updated_by = 'buyer' 
        WHERE id = ? AND buyer_id = ? AND status = 'Pending'
      `;
      await connection.query(query, [counterAmount, message, offerId, buyerId]);
    }

    connection.release();
    res.json({
      success: true,
      message: "Offer response updated successfully.",
    });
  } catch (error) {
    console.error("Error responding to offer:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Fetch product details based on offer_id
router.get("/offer-product/:offerId", async (req, res) => {
  const { offerId } = req.params;

  try {
    const connection = await pool.getConnection();

    const query = `
          SELECT * 
          FROM offers 
          WHERE id = ?;
      `;

    const [rows] = await connection.query(query, [offerId]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Product details not found." });
    }

    res.json({ success: true, product: rows[0] });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;
