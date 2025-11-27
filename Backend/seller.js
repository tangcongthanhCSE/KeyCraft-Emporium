// File: backend/seller.js
const express = require('express');
const db = require('./db'); // Database connection
const { verifySeller } = require('./middleware'); // Middleware to ensure user is a Seller
const router = express.Router();

// ==================================================================
// API: GET MY PRODUCTS (View list of products owned by logged-in seller)
// Endpoint: GET /api/seller/products
// ==================================================================
router.get('/products', verifySeller, async (req, res) => {
    const sellerId = req.user.id; // Get SellerID from Token

    try {
        const [rows] = await db.query(
            'SELECT * FROM PRODUCT WHERE SellerID = ? ORDER BY ProductID DESC', 
            [sellerId]
        );
        res.json(rows);
    } catch (error) {
        console.error("Get My Products Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==================================================================
// API: ADD NEW PRODUCT (Call Stored Procedure 2.1)
// Endpoint: POST /api/seller/products
// ==================================================================
router.post('/products', verifySeller, async (req, res) => {
    const sellerId = req.user.id; 
    const { name, description, price, stock, weight, dimensions, condition, isPreOrder } = req.body;

    try {
        // Call SP: sp_InsertProduct
        const [rows] = await db.query(
            'CALL sp_InsertProduct(?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, description, price, stock, weight, dimensions, condition || 'New', isPreOrder || false, sellerId]
        );

        res.status(201).json(rows[0][0]);

    } catch (error) {
        console.error("Add Product Error:", error);
        res.status(400).json({ error: error.sqlMessage || error.message });
    }
});

// ==================================================================
// API: UPDATE PRODUCT (Call Stored Procedure 2.1)
// Endpoint: PUT /api/seller/products/:id
// ==================================================================
router.put('/products/:id', verifySeller, async (req, res) => {
    const productId = req.params.id;
    const sellerId = req.user.id;
    const { name, description, price, stock, weight, dimensions, condition, isPreOrder } = req.body;

    try {
        // 1. Security Check: Verify Ownership
        const [check] = await db.query('SELECT SellerID FROM PRODUCT WHERE ProductID = ?', [productId]);
        
        if (check.length === 0) return res.status(404).json({ error: "Product not found" });
        if (check[0].SellerID !== sellerId) {
            return res.status(403).json({ error: "You do not have permission to edit this product!" });
        }

        // 2. Call SP: sp_UpdateProduct
        await db.query(
            'CALL sp_UpdateProduct(?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [productId, name, description, price, stock, weight, dimensions, condition, isPreOrder]
        );

        res.json({ message: "Product updated successfully!" });

    } catch (error) {
        res.status(400).json({ error: error.sqlMessage || error.message });
    }
});

// ==================================================================
// API: DELETE PRODUCT (Call Stored Procedure 2.1)
// Endpoint: DELETE /api/seller/products/:id
// ==================================================================
router.delete('/products/:id', verifySeller, async (req, res) => {
    const productId = req.params.id;
    const sellerId = req.user.id;

    try {
        // 1. Security Check: Verify Ownership
        const [check] = await db.query('SELECT SellerID FROM PRODUCT WHERE ProductID = ?', [productId]);
        
        if (check.length === 0) return res.status(404).json({ error: "Product not found" });
        if (check[0].SellerID !== sellerId) {
            return res.status(403).json({ error: "You do not have permission to delete this product!" });
        }

        // 2. Call SP: sp_DeleteProduct
        await db.query('CALL sp_DeleteProduct(?)', [productId]);

        res.json({ message: "Product deleted successfully!" });

    } catch (error) {
        res.status(400).json({ error: error.sqlMessage || error.message });
    }
});

// ==================================================================
// API: SALES ANALYTICS REPORT (Call Stored Procedure 2.3)
// Endpoint: GET /api/seller/analytics
// Query Params: ?start=YYYY-MM-DD&end=YYYY-MM-DD&minSold=INT
// ==================================================================
router.get('/analytics', verifySeller, async (req, res) => {
    const sellerId = req.user.id; // Extract SellerID from Token
    const { start, end, minSold } = req.query;

    // Set default values if params are missing
    // Default range: Current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; // YYYY-MM-01
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]; // YYYY-MM-Last

    const startDate = start || firstDay;
    const endDate = end || lastDay;
    const minQuantity = minSold || 0; // Default: show all sold products

    try {
        // Call SP: sp_GetBestSellingReport (Defined in SQL Part 2.3)
        const [rows] = await db.query(
            'CALL sp_GetBestSellingReport(?, ?, ?, ?)',
            [sellerId, startDate, endDate, minQuantity]
        );

        // SP returns data in the first element of the array
        res.json({
            meta: { from: startDate, to: endDate, min_sold: minQuantity },
            data: rows[0] 
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Failed to retrieve analytics data." });
    }
});

module.exports = router;