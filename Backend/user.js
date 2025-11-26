// File: user.js
const express = require('express');
const db = require('./db'); // Connection to Aiven MySQL
const { verifyToken } = require('./middleware'); // Protect routes
const router = express.Router();

// ==================================================================
// API: UPDATE USER PROFILE
// Endpoint: PUT /api/user/profile
// Header: Authorization: Bearer <token>
// Body: { avatar, phone, address: { ... } }
// ==================================================================
router.put('/profile', verifyToken, async (req, res) => {
    const userId = req.user.id; // Extracted from JWT token
    const { avatar, phone, address } = req.body;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Update Avatar in 'USERS' table
        if (avatar) {
            await connection.query(
                'UPDATE USERS SET Avatar = ? WHERE UserID = ?',
                [avatar, userId]
            );
        }

        // 2. Update Phone Number in 'USER_PHONE' table
        // Strategy: Delete old number -> Insert new number (Simplifies logic)
        if (phone) {
            await connection.query('DELETE FROM USER_PHONE WHERE UserID = ?', [userId]);
            await connection.query(
                'INSERT INTO USER_PHONE (UserID, PhoneNumber) VALUES (?, ?)',
                [userId, phone]
            );
        }

        // 3. Add New Address to 'ADDRESS' table
        if (address) {
            // Since ADDRESS uses a composite key (UserID, AddressID), we must calculate the next AddressID.
            const [rows] = await connection.query(
                'SELECT MAX(AddressID) as maxId FROM ADDRESS WHERE UserID = ?',
                [userId]
            );
            const nextAddressId = (rows[0].maxId || 0) + 1;

            // If this is the first address, set it as default (IsDefault = 1)
            const isDefault = nextAddressId === 1 ? 1 : 0; 

            await connection.query(
                `INSERT INTO ADDRESS 
                (UserID, AddressID, ReceiverName, Phone, City, District, Street, IsDefault, AddressType) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, 
                    nextAddressId, 
                    address.receiverName, 
                    address.phone || phone, // Use address specific phone or fallback to main phone
                    address.city, 
                    address.district, 
                    address.street, 
                    isDefault,
                    address.addressType || 'Delivery'
                ]
            );
        }

        await connection.commit(); // Save changes
        res.json({ message: "Profile updated successfully!" });

    } catch (error) {
        if (connection) await connection.rollback(); // Revert changes on error
        console.error("Update Profile Error:", error);
        res.status(500).json({ error: "Failed to update profile: " + error.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==================================================================
// API: GET USER PROFILE
// Endpoint: GET /api/user/profile
// Header: Authorization: Bearer <token>
// Description: Fetches all user info including phones and addresses.
// ==================================================================
router.get('/profile', verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // 1. Get Basic Info + Buyer Info (Left Join in case user is not a buyer, though unlikely)
        const [users] = await db.query(`
            SELECT u.UserID, u.Username, u.Email, u.Avatar, b.CoinBalance, b.MembershipLevel 
            FROM USERS u
            LEFT JOIN BUYER b ON u.UserID = b.UserID
            WHERE u.UserID = ?
        `, [userId]);

        if (users.length === 0) return res.status(404).json({ error: "User not found." });
        const user = users[0];

        // 2. Get Phone Numbers
        const [phones] = await db.query('SELECT PhoneNumber FROM USER_PHONE WHERE UserID = ?', [userId]);
        user.phones = phones.map(p => p.PhoneNumber);

        // 3. Get Addresses
        const [addresses] = await db.query('SELECT * FROM ADDRESS WHERE UserID = ?', [userId]);
        user.addresses = addresses;

        res.json(user);

    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ error: "Failed to retrieve profile." });
    }
});

module.exports = router;