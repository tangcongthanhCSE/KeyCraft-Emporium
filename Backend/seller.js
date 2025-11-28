// File: backend/seller.js
const express = require('express');
const db = require('./db'); 
const { verifySeller } = require('./middleware'); 
const router = express.Router();

// ==================================================================
// API: GET MY PRODUCTS
// ==================================================================
router.get('/products', verifySeller, async (req, res) => {
    const sellerId = req.user.id;
    try {
        const [rows] = await db.query('SELECT * FROM PRODUCT WHERE SellerID = ? ORDER BY ProductID DESC', [sellerId]);
        res.json(rows);
    } catch (error) {
        console.error("Get My Products Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==================================================================
// API: ADD NEW PRODUCT (SP 2.1)
// ==================================================================
router.post('/products', verifySeller, async (req, res) => {
    const sellerId = req.user.id; 
    // Lấy thêm 'image' từ body
    const { name, description, price, stock, weight, dimensions, condition, isPreOrder, image } = req.body;

    try {
        const [rows] = await db.query(
            // Thêm tham số ? vào cuối cho ImageURL
            'CALL sp_InsertProduct(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, description, price, stock, weight, dimensions, condition || 'New', isPreOrder || false, sellerId, image || null]
        );
        res.status(201).json(rows[0][0]);
    } catch (error) {
        console.error("Add Product Error:", error);
        res.status(400).json({ error: error.sqlMessage || error.message });
    }
});

// ==================================================================
// API: UPDATE PRODUCT (SP 2.1)
// ==================================================================
router.put('/products/:id', verifySeller, async (req, res) => {
    const productId = req.params.id;
    const sellerId = req.user.id;
    const { name, description, price, stock, weight, dimensions, condition, isPreOrder, image } = req.body;

    try {
        const [check] = await db.query('SELECT SellerID FROM PRODUCT WHERE ProductID = ?', [productId]);
        
        if (check.length === 0) return res.status(404).json({ error: "Product not found" });
        if (check[0].SellerID !== sellerId) return res.status(403).json({ error: "Access Denied" });

        // Use NULLIF to handle empty strings sent by frontend
        await db.query(
            `UPDATE PRODUCT SET
                Name = COALESCE(NULLIF(?, ''), Name),
                Description = COALESCE(NULLIF(?, ''), Description),
                BasePrice = COALESCE(NULLIF(?, ''), BasePrice),
                StockQuantity = COALESCE(NULLIF(?, ''), StockQuantity),
                Weight = COALESCE(NULLIF(?, ''), Weight),
                Dimensions = COALESCE(NULLIF(?, ''), Dimensions),
                ConditionState = COALESCE(NULLIF(?, ''), ConditionState),
                IsPreOrder = COALESCE(NULLIF(?, ''), IsPreOrder),
                ImageURL = COALESCE(NULLIF(?, ''), ImageURL)
            WHERE ProductID = ?`,
            [name, description, price, stock, weight, dimensions, condition, isPreOrder, image, productId]
        );

        res.json({ message: "Product updated successfully!" });

    } catch (error) {
        res.status(400).json({ error: error.sqlMessage || error.message });
    }
});
// ==================================================================
// API: DELETE PRODUCT (SP 2.1)
// ==================================================================
router.delete('/products/:id', verifySeller, async (req, res) => {
    const productId = req.params.id;
    const sellerId = req.user.id;

    try {
        const [check] = await db.query('SELECT SellerID FROM PRODUCT WHERE ProductID = ?', [productId]);
        if (check.length === 0) return res.status(404).json({ error: "Product not found" });
        if (check[0].SellerID !== sellerId) return res.status(403).json({ error: "You do not have permission to delete this product!" });

        await db.query('CALL sp_DeleteProduct(?)', [productId]);
        res.json({ message: "Product deleted successfully!" });
    } catch (error) {
        res.status(400).json({ error: error.sqlMessage || error.message });
    }
});

// ==================================================================
// API: SALES ANALYTICS REPORT (SP 2.3)
// ==================================================================
router.get('/analytics', verifySeller, async (req, res) => {
    const sellerId = req.user.id;
    const { start, end, minSold } = req.query;
    const now = new Date();
    const startDate = start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = end || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const minQuantity = minSold || 0;

    try {
        const [rows] = await db.query('CALL sp_GetBestSellingReport(?, ?, ?, ?)', [sellerId, startDate, endDate, minQuantity]);
        res.json({ meta: { from: startDate, to: endDate }, data: rows[0] });
    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Failed to retrieve analytics data." });
    }
});

// ==================================================================
// [NEW] API: CALCULATE MONTHLY REVENUE (Call Function 2.4.2)
// Endpoint: GET /api/seller/monthly-revenue
// Query: ?month=6&year=2024
// ==================================================================
router.get('/monthly-revenue', verifySeller, async (req, res) => {
    const sellerId = req.user.id;
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();

    try {
        // Execute SQL Function: SELECT fn_CalculateShopMonthlyRevenue(?, ?, ?)
        const [rows] = await db.query(
            'SELECT fn_CalculateShopMonthlyRevenue(?, ?, ?) AS MonthlyRevenue', 
            [sellerId, month, year]
        );
        
        res.json({ 
            month: month,
            year: year,
            revenue: rows[0].MonthlyRevenue || 0 // Handle null result
        });

    } catch (error) {
        console.error("Calc Revenue Error:", error);
        res.status(500).json({ error: "Failed to calculate monthly revenue." });
    }
});

module.exports = router;