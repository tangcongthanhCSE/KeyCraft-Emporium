// File: backend/cart.js
const express = require('express');
const db = require('./db');
const { verifyToken } = require('./middleware');
const router = express.Router();

// ==================================================================
// API: ADD ITEM TO CART
// Endpoint: POST /api/cart/add
// Header: Authorization: Bearer <token>
// Body: { productId, quantity }
// ==================================================================
router.post('/add', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { productId, quantity } = req.body;

    // 1. Basic Validation
    if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({ error: "Invalid product or quantity." });
    }

    try {
        // 2. Check Product Existence & Stock
        const [products] = await db.query('SELECT SellerID, StockQuantity, Name FROM PRODUCT WHERE ProductID = ?', [productId]);
        
        if (products.length === 0) {
            return res.status(404).json({ error: "Product not found." });
        }
        
        const product = products[0];

        // 3. RULE: Seller cannot buy their own product
        if (userRole === 'Seller' && product.SellerID === userId) {
            return res.status(403).json({ error: "You cannot add your own product to the cart." });
        }

        // 4. Check Stock Availability
        if (quantity > product.StockQuantity) {
            return res.status(400).json({ error: `Not enough stock. Only ${product.StockQuantity} left.` });
        }

        // 5. Add to Cart (Upsert Logic)
        // If item exists, update quantity. If not, insert new.
        // Note: CART_ITEM Primary Key is (BuyerID, ProductID)
        
        // First, check if item exists in cart
        const [existingItem] = await db.query(
            'SELECT Quantity FROM CART_ITEM WHERE BuyerID = ? AND ProductID = ?',
            [userId, productId]
        );

        if (existingItem.length > 0) {
            // Item exists: Update quantity
            const newQuantity = existingItem[0].Quantity + parseInt(quantity);
            
            // Re-check stock with new total quantity
            if (newQuantity > product.StockQuantity) {
                return res.status(400).json({ error: "Total quantity in cart exceeds available stock." });
            }

            await db.query(
                'UPDATE CART_ITEM SET Quantity = ? WHERE BuyerID = ? AND ProductID = ?',
                [newQuantity, userId, productId]
            );
        } else {
            // Item does not exist: Insert new
            await db.query(
                'INSERT INTO CART_ITEM (BuyerID, ProductID, Quantity) VALUES (?, ?, ?)',
                [userId, productId, quantity]
            );
        }

        res.json({ message: `Added ${quantity} x ${product.Name} to cart!` });

    } catch (error) {
        console.error("Add to Cart Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// ==================================================================
// API: GET CART ITEMS
// Endpoint: GET /api/cart
// ==================================================================
router.get('/', verifyToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // Join CART_ITEM with PRODUCT to get details
        const [items] = await db.query(`
            SELECT c.ProductID, p.Name, p.BasePrice, c.Quantity, p.ImageURL, p.StockQuantity, p.SellerID, s.ShopName
            FROM CART_ITEM c
            JOIN PRODUCT p ON c.ProductID = p.ProductID
            JOIN SELLER s ON p.SellerID = s.UserID
            WHERE c.BuyerID = ?
        `, [userId]);
        res.json(items);
    } catch (error) {
        console.error("Get Cart Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==================================================================
// API: CHECKOUT (PLACE ORDER)
// Endpoint: POST /api/cart/checkout
// Body: { paymentMethod, addressId, items: [{productId, quantity}] }
// Note: 'items' is optional. If not provided, checkout ALL items in cart.
// ==================================================================
router.post('/checkout', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { paymentMethod, addressId, items } = req.body; // items = specific list to checkout

    if (!paymentMethod || !addressId) {
        return res.status(400).json({ error: "Missing payment method or address." });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Get items to checkout
        let cartItems = [];
        if (items && items.length > 0) {
            // Checkout specific items (Not implemented fully in this demo, assume full cart for simplicity)
            // For now, we will query the DB for prices of these specific items
            const ids = items.map(i => i.productId);
            const [rows] = await connection.query(
                `SELECT p.ProductID, p.BasePrice, c.Quantity, p.SellerID 
                 FROM CART_ITEM c JOIN PRODUCT p ON c.ProductID = p.ProductID 
                 WHERE c.BuyerID = ? AND c.ProductID IN (?)`, 
                [userId, ids]
            );
            cartItems = rows;
        } else {
            // Checkout ALL items in cart
            const [rows] = await connection.query(
                `SELECT p.ProductID, p.BasePrice, c.Quantity, p.SellerID 
                 FROM CART_ITEM c JOIN PRODUCT p ON c.ProductID = p.ProductID 
                 WHERE c.BuyerID = ?`, 
                [userId]
            );
            cartItems = rows;
        }

        if (cartItems.length === 0) {
            throw new Error("Cart is empty or items not found.");
        }

        // 2. Group items by Seller (Shopee creates separate orders for different shops)
        // Logic: One Order per Seller
        const ordersBySeller = {};
        cartItems.forEach(item => {
            if (!ordersBySeller[item.SellerID]) ordersBySeller[item.SellerID] = [];
            ordersBySeller[item.SellerID].push(item);
        });

        // 3. Process each order
        for (const sellerId in ordersBySeller) {
            const sellerItems = ordersBySeller[sellerId];
            
            // A. Create Order Header (Initial Total = 0, Trigger will update)
            const [orderRes] = await connection.query(
                'INSERT INTO ORDERS (BuyerID, OrderDate, TotalAmount, FinalTotal) VALUES (?, NOW(), 0, 0)',
                [userId]
            );
            const orderId = orderRes.insertId;

            // B. Create Shipment (Default Status)
            const [shipRes] = await connection.query(
                `INSERT INTO SHIPMENT (TrackingNumber, Carrier, ShippingFee, Status, EstimatedDeliveryDate) 
                 VALUES (?, 'SPX', 15.00, 'Preparing', DATE_ADD(NOW(), INTERVAL 3 DAY))`,
                [`TRK${Date.now()}${orderId}`]
            );
            const shipmentId = shipRes.insertId;

            // C. Create Payment
            const payStatus = paymentMethod === 'COD' ? 'Pending' : 'Paid'; // Logic đơn giản
            const [payRes] = await connection.query(
                'INSERT INTO PAYMENT (Method, Status, PaidAt, Amount) VALUES (?, ?, NOW(), 0)',
                [paymentMethod, payStatus]
            );
            const transactionId = payRes.insertId;

            // D. Create Order Details (This triggers Stock Update & Total Calc)
            for (const item of sellerItems) {
                await connection.query(
                    `INSERT INTO ORDER_DETAIL (OrderID, ProductID, Quantity, UnitPrice, ShipmentID, TransactionID) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [orderId, item.ProductID, item.Quantity, item.BasePrice, shipmentId, transactionId]
                );

                // Remove from Cart
                await connection.query(
                    'DELETE FROM CART_ITEM WHERE BuyerID = ? AND ProductID = ?',
                    [userId, item.ProductID]
                );
            }

            // E. Update Payment Amount (Sync with Order FinalTotal)
            // Because Trigger updated Order Total, we need to fetch it or calc it.
            // For simplicity, we update Payment Amount based on sum of items.
            await connection.query(
                `UPDATE PAYMENT p 
                 JOIN ORDERS o ON p.TransactionID = ? AND o.OrderID = ?
                 SET p.Amount = o.FinalTotal`,
                [transactionId, orderId]
            );
        }

        await connection.commit();
        res.json({ message: "Order placed successfully!" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Checkout Error:", error);
        res.status(500).json({ error: error.message || "Checkout Failed" });
    } finally {
        if (connection) connection.release();
    }
});
// ==================================================================
// API: REMOVE ITEM FROM CART
// Endpoint: DELETE /api/cart/remove/:productId
// ==================================================================
router.delete('/remove/:productId', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const productId = req.params.productId;

    try {
        const [result] = await db.query(
            'DELETE FROM CART_ITEM WHERE BuyerID = ? AND ProductID = ?',
            [userId, productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Item not found in cart." });
        }

        res.json({ message: "Item removed from cart." });

    } catch (error) {
        console.error("Remove Cart Item Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;