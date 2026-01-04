# ThriftEx: The Sustainable Style Exchange

ThriftEx is a negotiation-based e-commerce platform designed for buying and selling second-hand clothing. The platform addresses the growing demand for sustainable fashion by creating a marketplace where users can extend the lifecycle of clothing through resale and purchase of pre-loved items.

## Overview

The application provides a complete e-commerce experience with an emphasis on user interaction through its negotiation system. Buyers can submit offers on listings, and sellers can accept, counter, or decline these proposals. This feature differentiates ThriftEx from traditional fixed-price marketplaces and creates a more dynamic shopping experience.

## Technical Implementation

**Frontend**
- HTML, CSS, JavaScript
- Bootstrap for responsive design

**Backend**
- Node.js with Express.js framework
- RESTful API architecture

**Database**
- MySQL for relational data management

**Third-Party Integrations**
- Google OAuth 2.0 for authentication
- Razorpay for payment processing
- Cloudinary for image storage and management

**Security**
- Environment-based configuration management
- Session handling with secure secrets

## Core Features

**User Management**
- Dual account types supporting both buying and selling activities
- Google OAuth integration for streamlined authentication

**Product System**
- Image upload and management through Cloudinary
- Search functionality with filtering options
- Stock tracking and availability management

**Negotiation Mechanism**
The platform's signature feature allows buyers to submit best offers on listings. Sellers can review incoming offers through their dashboard and respond with acceptance, counteroffers, or rejection. This creates a more engaging transaction process compared to standard e-commerce platforms.

**Seller Dashboard**
- Sales analytics and performance metrics
- Order management interface
- Inventory oversight

**Shopping Experience**
- Wishlist functionality for saving items
- Shopping cart system
- Comprehensive order history
- Integrated payment processing via Razorpay

## Setup Instructions

### Prerequisites
- Node.js installed on your system
- MySQL database instance
- Accounts configured for Cloudinary, Google OAuth, and Razorpay

### Installation

Clone the repository:
```bash
git clone https://github.com/insiyaarsi/thriftex.git
cd thriftex
```

Install dependencies:
```bash
npm install
```

### Configuration

Create a `.env` file in the root directory with the following variables:

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

### Running the Application

Start the server:
```bash
node app.js
```

Access the application at `http://localhost:3000`

## Security Considerations

All sensitive credentials are managed through environment variables and excluded from version control via `.gitignore`. Authentication tokens and payment gateway keys are never exposed in the codebase.

## License

This project is intended for educational and portfolio purposes.
