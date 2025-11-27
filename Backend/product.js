// File: backend/product.js
const express = require('express');
const db = require('./db'); // Database connection pool
const router = express.Router();

// ==================================================================
// API: ADVANCED PRODUCT SEARCH
// Endpoint: GET /api/products/search
// Query Params: 
//   - keyword (optional): string to match product name
//   - min (optional): minimum price
//   - max (optional): maximum price
// Usage Example: /api/products/search?keyword=Key&min=50&max=200
// ==================================================================
router.get('/search', async (req, res) => {
    try {
        // 1. Extract parameters from the URL query string
        // If a parameter is missing or empty string, set it to NULL for the Stored Procedure
        const keyword = req.query.keyword || null;
        const minPrice = req.query.min ? parseFloat(req.query.min) : null;
        const maxPrice = req.query.max ? parseFloat(req.query.max) : null;

        // 2. Call the Stored Procedure 'sp_SearchProductsAdvanced'
        // This SP handles filtering logic (AND conditions) and sorting.
        const [rows] = await db.query(
            'CALL sp_SearchProductsAdvanced(?, ?, ?)',
            [keyword, minPrice, maxPrice]
        );

        // 3. Return the result set (rows[0] contains the actual data from SP)
        res.json(rows[0]);

    } catch (error) {
        console.error("Search API Error:", error);
        res.status(500).json({ error: "Internal Server Error during search processing." });
    }
});

module.exports = router;