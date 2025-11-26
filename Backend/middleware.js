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
    // Get the 'Authorization' header from the request
    const authHeader = req.headers['authorization'];
    
    // Expected format: "Bearer <token_string>"
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) {
        // 401 Unauthorized: No token provided
        return res.status(401).json({ error: "Access Denied. No token provided." });
    }

    try {
        // Verify the token using the secret key
        const verified = jwt.verify(token, JWT_SECRET);
        
        // Attach the decoded user payload (id, role, username) to the request object
        // This allows downstream route handlers to access 'req.user'
        req.user = verified; 
        
        next(); // Proceed to the next middleware or route handler
    } catch (err) {
        // 403 Forbidden: Token is invalid or expired
        console.error("Token Verification Error:", err.message); 
        res.status(403).json({ error: "Invalid or expired token." }); 
    }
};

/**
 * Middleware: verifyAdmin
 * Purpose: Ensure the authenticated user has the 'Admin' role.
 */
const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role === 'Admin') {
            next(); // User is Admin, proceed
        } else {
            res.status(403).json({ error: "Access Denied. Admin privileges required." });
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