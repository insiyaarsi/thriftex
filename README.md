# 👗 ThriftEx: The Sustainable Style Exchange

**ThriftEx** is a negotiation-based e-commerce platform for second-hand clothing. It allows users to buy and sell pre-loved clothes while encouraging sustainable fashion choices. With features like price negotiation, seller dashboards, analytics, wishlist, and secure payment integration, ThriftEx combines functionality with purpose.

---

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript, Bootstrap  
- **Backend:** Node.js, Express.js  
- **Database:** MySQL  
- **Authentication:** Google OAuth 2.0  
- **Payment Gateway:** Razorpay  
- **Cloud Storage:** Cloudinary  
- **Environment Variables:** Managed using `.env`

---

## 🚀 Features

- 🧑‍💼 Buyer & Seller Account Management
- 📦 Product Listings with Images
- 💬 Price Negotiation (Best Offer) System
- 📊 Seller Dashboard with Sales Analytics
- 🔍 Smart Search & Filters
- 🛒 Wishlist and Cart Functionality
- 💳 Razorpay Payment Integration
- 📚 Order History & Stock Management

---

## ⚙️ Getting Started

### 1. Clone the Repository

bash: 
git clone https://github.com/insiyaarsi/thriftex.git
cd thriftex 

### 2. Install Dependencies
npm install

###3. Configure Your .env File
Create a .env file in the root directory and add the following:

```
# Database Configuration
DB_HOST=your_mysql_host
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_db_name

# Cloudinary (for image storage)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Session Secret
SESSION_SECRET=your-session-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Server Port
PORT=3000
```

### 4. Run the server
node app.js

### 5. Visit the app
http://localhost:3000

### Security Notes
All secrets are stored in a .env file and excluded via .gitignore

Google OAuth and Razorpay keys are never hardcoded

### License
This project is for educational purposes only.
Please provide a request before you decide to work with it. 
