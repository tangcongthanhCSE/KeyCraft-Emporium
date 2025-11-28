// File: backend/index.js
const express = require('express');
const cors = require('cors');
const db = require('./db');

// Import Route Handlers
const authRoutes = require('./auth');
const userRoutes = require('./user');
const adminRoutes = require('./admin');
const sellerRoutes = require('./seller');
const productRoutes = require('./product');
const cartRoutes = require('./cart');


require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors()); 
app.use(express.json()); 

// --- REGISTER ROUTES ---
app.use('/api/auth', authRoutes);      // Auth (Login/Register)
app.use('/api/user', userRoutes);      // User Profile
app.use('/api/admin', adminRoutes);    // Admin Dashboard
app.use('/api/seller', sellerRoutes);  // Seller Dashboard
app.use('/api/products', productRoutes); // Product Management
app.use('/api/cart', cartRoutes);        // Shopping Cart
// 1. Health Check
app.get('/', (req, res) => {
    res.send('🚀 KeyCraft Emporium Backend is running...');
});

// 2. DB Connection Test
app.get('/api/test-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 as result');
        res.json({ message: "✅ DB Connection OK!", test: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "DB Connection Failed" });
    }
});

// --- START SERVER ---
app.listen(port, () => {
    console.log(`------------------------------------------------`);
    console.log(`🚀 Server running at: http://localhost:${port}`);
    console.log(`------------------------------------------------`);
});