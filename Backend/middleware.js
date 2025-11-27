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
    console.log("   [1] Đang kiểm tra Token..."); // <--- LOG DEBUG

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) {
        console.log("   [Error] Không tìm thấy Token trong Header!"); // <--- LOG DEBUG
        return res.status(401).json({ error: "Truy cập bị từ chối. Vui lòng gửi kèm Token." });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        console.log("   [2] Token hợp lệ! User decoded:", verified); // <--- LOG DEBUG QUAN TRỌNG: Xem role là gì
        next(); 
    } catch (err) {
        console.log("   [Error] Token lỗi:", err.message); // <--- LOG DEBUG: Xem lỗi cụ thể (hết hạn hay sai key)
        res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    }
};

// 2. Middleware phân quyền Admin
const verifyAdmin = (req, res, next) => {
    console.log("Middleware Admin đang kiểm tra...");
    
    verifyToken(req, res, () => {
        // Khi verifyToken chạy xong next(), nó sẽ nhảy vào đây
        console.log("   [3] Đang check Role Admin. Role hiện tại là:", req.user.role); // <--- LOG DEBUG

        if (req.user.role === 'Admin') {
            console.log("   [4] Role đúng là Admin -> Cho qua!"); // <--- LOG DEBUG
            next();
        } else {
            console.log("   [Error] Bị chặn vì Role không phải Admin!"); // <--- LOG DEBUG
            res.status(403).json({ error: "Bạn không có quyền Admin!" });
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