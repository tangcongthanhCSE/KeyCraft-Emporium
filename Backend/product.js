// File: backend/product.js
const express = require('express');
const db = require('./db'); // Database connection pool
const router = express.Router();

// ==================================================================
// API: ADVANCED PRODUCT SEARCH (With Sorting)
// Endpoint: GET /api/products/search
// Params: ?keyword=...&min=...&max=...&sort=ASC|DESC
// ==================================================================
router.get('/search', async (req, res) => {
    try {
        const keyword = req.query.keyword || null;
        const minPrice = req.query.min ? parseFloat(req.query.min) : null;
        const maxPrice = req.query.max ? parseFloat(req.query.max) : null;
        
        // Get sort order, default to 'ASC' if not provided
        const sortOrder = req.query.sort === 'DESC' ? 'DESC' : 'ASC';

        // Call SP with 4 parameters
        const [rows] = await db.query(
            'CALL sp_SearchProductsAdvanced(?, ?, ?, ?)',
            [keyword, minPrice, maxPrice, sortOrder]
        );

        res.json(rows[0]);

    } catch (error) {
        console.error("Search API Error:", error);
        res.status(500).json({ error: "Internal Server Error during search processing." });
    }
});

// ==================================================================
// API: SUBMIT REVIEW
// Endpoint: POST /api/products/review
// Body: { productId, rating, orderId } <--- Added orderId to track specific purchase
// ==================================================================
router.post('/review', async (req, res) => { // Note: Should verifyToken here to identify user
    // For simplicity as per previous code, we trust the body, but in real app use verifyToken
    const { productId, rating, orderDetailId } = req.body; 
    
    if (!productId || !rating || !orderDetailId) {
        return res.status(400).json({ error: "Invalid data." });
    }

    try {
        // 1. Check if already rated
        const [check] = await db.query(
            'SELECT IsRated FROM ORDER_DETAIL WHERE OrderDetailID = ?', 
            [orderDetailId]
        );

        if (check.length === 0) return res.status(404).json({ error: "Order detail not found." });
        if (check[0].IsRated) {
            return res.status(400).json({ error: "You have already rated this product for this order." });
        }

        // 2. Update Product Rating (Weighted Average)
        const [prod] = await db.query('SELECT Rating, ReviewCount FROM PRODUCT WHERE ProductID = ?', [productId]);
        const currentRating = parseFloat(prod[0].Rating || 0);
        const currentCount = parseInt(prod[0].ReviewCount || 0);
        
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount) + parseFloat(rating)) / newCount;

        await db.query(
            'UPDATE PRODUCT SET Rating = ?, ReviewCount = ? WHERE ProductID = ?',
            [newRating, newCount, productId]
        );

        // 3. Mark as Rated
        await db.query('UPDATE ORDER_DETAIL SET IsRated = TRUE WHERE OrderDetailID = ?', [orderDetailId]);

        res.json({ 
            message: "Review submitted successfully!", 
            newRating: newRating.toFixed(2),
            totalReviews: newCount
        });

    } catch (error) {
        console.error("Review Error:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;