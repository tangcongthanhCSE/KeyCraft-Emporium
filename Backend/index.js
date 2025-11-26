// File: index.js
const express = require('express');
const cors = require('cors');
const db = require('./db'); // Import database connection
const authRoutes = require('./auth'); // Import Auth routes
const userRoutes = require('./user'); // Import User routes
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors()); // Enable Cross-Origin Resource Sharing (Allows frontend to call API)
app.use(express.json()); // Parse incoming JSON request bodies

// --- ROUTES ---
// Mount auth routes at /api/auth
app.use('/api/auth', authRoutes);
// Mount user routes at /api/user
app.use('/api/user', userRoutes);

// 1. Health Check Endpoint
app.get('/', (req, res) => {
    res.send('🚀 KeyCraft Emporium Backend is running (Connected to Aiven MySQL)...');
});

// 2. Database Connection Test Endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 as result');
        res.json({ 
            message: "Aiven MySQL Connection Successful!", 
            test_result: rows 
        });
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ error: "Database connection failed." });
    }
});

// --- START SERVER ---
app.listen(port, () => {
    console.log(`------------------------------------------------`);
    console.log(`🚀 Server running at: http://localhost:${port}`);
    console.log(`------------------------------------------------`);
});