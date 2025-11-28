// File: middleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config(); 

// Secret key for signing tokens. Must match the one used in auth.js.
const JWT_SECRET = process.env.JWT_SECRET || 'keycraft_secret_key_2024'; 

/**
 * Middleware: verifyToken
 * Purpose: Check if the request has a valid JWT token in the Authorization header.
 * Usage: Add this middleware to any protected route.
 */
const verifyToken = (req, res, next) => {
    console.log("   [1] Checking Token..."); // <--- LOG DEBUG

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) {
        console.log("   [Error] Token not found in Header!"); // <--- LOG DEBUG
        return res.status(401).json({ error: "Access denied. Please provide a token." });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        console.log("   [2] Token valid! User decoded:", verified); // <--- LOG DEBUG IMPORTANT: Check what role it is
        next(); 
    } catch (err) {
        console.log("   [Error] Token error:", err.message); // <--- LOG DEBUG: Check specific error (expired or wrong key)
        res.status(403).json({ error: "Token is invalid or has expired" });
    }
};

// 2. Middleware phân quyền Admin
const verifyAdmin = (req, res, next) => {
    console.log("Middleware Admin is checking..."); // <--- LOG DEBUG
    
    verifyToken(req, res, () => {
        // Khi verifyToken chạy xong next(), nó sẽ nhảy vào đây
        console.log("   [3] Checking Admin Role. Current role is:", req.user.role); // <--- LOG DEBUG
        if (req.user.role === 'Admin') {
            console.log("   [4] Role is Admin -> Allowing access!"); // <--- LOG DEBUG
            next();
        } else {
            console.log("   [Error] Access denied because role is not Admin!"); // <--- LOG DEBUG
            res.status(403).json({ error: "You do not have Admin privileges!" });
        }
    });
};

/**
 * Middleware: verifySeller
 * Purpose: Ensure the authenticated user has the 'Seller' (or 'Admin') role.
 */
const verifySeller = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role === 'Seller' || req.user.role === 'Admin') {
            next(); // User is Seller or Admin, proceed
        } else {
            res.status(403).json({ error: "Access Denied. Seller privileges required." });
        }
    });
};

module.exports = { verifyToken, verifyAdmin, verifySeller };