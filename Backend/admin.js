// File: backend/admin.js
const express = require('express');
const db = require('./db'); // Database connection
const { verifyAdmin } = require('./middleware'); // Admin authorization middleware
const router = express.Router();

// ==================================================================
// GROUP 1: USER MANAGEMENT (BAN / UNBAN)
// ==================================================================

/**
 * API: Ban or Unban a User (Seller/Buyer)
 * Endpoint: PUT /api/admin/users/status
 * Header: Authorization: Bearer <admin_token>
 * Body: { "userId": 10, "status": "Banned" } or "Active"
 */
router.put('/users/status', verifyAdmin, async (req, res) => {
    const { userId, status } = req.body;

    // 1. Validation
    const validStatuses = ['Active', 'Banned', 'Inactive'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Use: 'Active', 'Banned', or 'Inactive'." });
    }

    try {
        // 2. Execute Update Query
        const [result] = await db.query(
            'UPDATE USERS SET Status = ? WHERE UserID = ?', 
            [status, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        res.json({ message: `User ${userId} has been updated to ${status}.` });

    } catch (error) {
        console.error("Ban User Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;