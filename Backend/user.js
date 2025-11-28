// File: backend/user.js
const express = require('express');
const db = require('./db');
const { verifyToken } = require('./middleware'); 
const router = express.Router();

// ==================================================================
// API: UPDATE USER PROFILE (Avatar, Phone, Address)
// Endpoint: PUT /api/user/profile
// ==================================================================
router.put('/profile', verifyToken, async (req, res) => {
    const userId = req.user.id; 
    const { avatar, phone, address } = req.body;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Update Avatar
        if (avatar) {
            await connection.query('UPDATE USERS SET Avatar = ? WHERE UserID = ?', [avatar, userId]);
        }

        // 2. Update Phone (Delete old -> Insert new strategy)
        if (phone) {
            await connection.query('DELETE FROM USER_PHONE WHERE UserID = ?', [userId]);
            await connection.query('INSERT INTO USER_PHONE (UserID, PhoneNumber) VALUES (?, ?)', [userId, phone]);
        }

        // 3. Add New Address
        if (address) {
            // Calculate next AddressID for composite key
            const [rows] = await connection.query('SELECT MAX(AddressID) as maxId FROM ADDRESS WHERE UserID = ?', [userId]);
            const nextAddressId = (rows[0].maxId || 0) + 1;
            
            // First address is default by default
            const isDefault = nextAddressId === 1 ? 1 : 0; 

            await connection.query(
                `INSERT INTO ADDRESS 
                (UserID, AddressID, ReceiverName, Phone, City, District, Street, IsDefault, AddressType) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, nextAddressId, address.receiverName, address.phone || phone, address.city, address.district, address.street, isDefault, address.addressType || 'Delivery']
            );
        }

        await connection.commit();
        res.json({ message: "Profile updated successfully!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Update Profile Error:", error);
        res.status(500).json({ error: "Failed to update profile: " + error.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==================================================================
// API: GET USER PROFILE
// Endpoint: GET /api/user/profile
// ==================================================================
router.get('/profile', verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // 1. Get Basic User Info + Buyer Data
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

// ==================================================================
// API: UPGRADE TO SELLER
// Endpoint: POST /api/user/become-seller
// ==================================================================
router.post('/become-seller', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { shopName, shopDescription } = req.body;

    if (!shopName) return res.status(400).json({ error: "Shop Name is required" });

    try {
        // Check if already a seller
        const [existing] = await db.query('SELECT UserID FROM SELLER WHERE UserID = ?', [userId]);
        if (existing.length > 0) return res.status(400).json({ error: "You are already a Seller!" });

        await db.query(
            'INSERT INTO SELLER (UserID, ShopName, ShopDescription, Rating, ResponseRate) VALUES (?, ?, ?, 5.0, 100)',
            [userId, shopName, shopDescription || '']
        );

        res.json({ message: "Congratulations! You are now a Seller." });
    } catch (error) {
        console.error("Register Seller Error:", error);
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: "Shop Name already taken." });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==================================================================
// API: CALCULATE MEMBERSHIP LEVEL (Call SQL Function)
// Endpoint: GET /api/user/membership-status
// ==================================================================
router.get('/membership-status', verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // Execute SQL Function: SELECT fn_CalculateMembershipLevel(?)
        const [rows] = await db.query('SELECT fn_CalculateMembershipLevel(?) AS CalculatedRank', [userId]);
        
        res.json({ 
            userId: userId,
            currentRank: rows[0].CalculatedRank 
        });
    } catch (error) {
        console.error("Calc Membership Error:", error);
        res.status(500).json({ error: "Failed to calculate membership." });
    }
});

// ==================================================================
// API: GET ORDER HISTORY (With 40s Lazy Update & Rating Info)
// Endpoint: GET /api/user/orders
// ==================================================================
router.get('/orders', verifyToken, async (req, res) => {
    const userId = req.user.id;

    try {
        // 1. LAZY UPDATE: Auto-update Shipment Status to 'Delivered' 
        // if OrderDate was more than 40 seconds ago.
        await db.query(`
            UPDATE SHIPMENT s
            JOIN ORDER_DETAIL od ON s.ShipmentID = od.ShipmentID
            JOIN ORDERS o ON od.OrderID = o.OrderID
            SET s.Status = 'Delivered', s.ActualDeliveryDate = NOW()
            WHERE o.BuyerID = ? 
            AND s.Status = 'Preparing'
            AND o.OrderDate < DATE_SUB(NOW(), INTERVAL 40 SECOND)
        `, [userId]);

        // 2. Fetch Orders with Details (Including OrderDetailID and IsRated)
        const [rows] = await db.query(`
            SELECT 
                o.OrderID, o.OrderDate, o.FinalTotal,
                s.Status AS ShipStatus, s.TrackingNumber,
                p.Method AS PayMethod, p.Status AS PayStatus,
                od.OrderDetailID, -- Needed for Rating
                od.IsRated,       -- Needed to check if already rated
                od.ProductID, pr.Name AS ProductName, pr.ImageURL, 
                od.Quantity, od.UnitPrice, pr.SellerID, sl.ShopName
            FROM ORDERS o
            JOIN ORDER_DETAIL od ON o.OrderID = od.OrderID
            JOIN SHIPMENT s ON od.ShipmentID = s.ShipmentID
            JOIN PAYMENT p ON od.TransactionID = p.TransactionID
            JOIN PRODUCT pr ON od.ProductID = pr.ProductID
            JOIN SELLER sl ON pr.SellerID = sl.UserID
            WHERE o.BuyerID = ?
            ORDER BY o.OrderDate DESC
        `, [userId]);

        // 3. Group data by OrderID
        const orders = {};
        rows.forEach(row => {
            if (!orders[row.OrderID]) {
                orders[row.OrderID] = {
                    OrderID: row.OrderID,
                    OrderDate: row.OrderDate,
                    FinalTotal: row.FinalTotal,
                    ShipStatus: row.ShipStatus,
                    PayMethod: row.PayMethod,
                    PayStatus: row.PayStatus,
                    Items: []
                };
            }
            orders[row.OrderID].Items.push({
                OrderDetailID: row.OrderDetailID,
                ProductID: row.ProductID,
                ProductName: row.ProductName,
                ImageURL: row.ImageURL,
                Quantity: row.Quantity,
                UnitPrice: row.UnitPrice,
                ShopName: row.ShopName,
                IsRated: row.IsRated
            });
        });

        res.json(Object.values(orders));

    } catch (error) {
        console.error("Get Orders Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;