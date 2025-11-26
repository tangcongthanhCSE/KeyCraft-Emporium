// File: db.js
const mysql = require('mysql2');
require('dotenv').config(); // Load environment variables from .env file

/**
 * Create a Connection Pool to Aiven MySQL.
 * Using a pool is more efficient than creating a new connection for every request.
 */
const pool = mysql.createPool({
    host: process.env.DB_HOST,       // Aiven Host (e.g., mysql-service.aivencloud.com)
    port: process.env.DB_PORT,       // Aiven Port (e.g., 12345 - NOT 3306)
    user: process.env.DB_USER,       // Database Username (e.g., avnadmin)
    password: process.env.DB_PASSWORD, // Database Password
    database: process.env.DB_NAME,   // Database Name (e.g., KeyCraftShopee)
    waitForConnections: true,        // Queue requests if no connections are available
    connectionLimit: 10,             // Max number of simultaneous connections
    queueLimit: 0,                   // Unlimited queueing
    
    // --- SSL CONFIGURATION FOR AIVEN ---
    // Aiven requires an SSL connection. 
    // 'rejectUnauthorized: false' allows self-signed certificates, which is standard for dev environments.
    ssl: {
        rejectUnauthorized: false
    }
});

// Export the pool as a Promise-based object to use 'async/await' syntax
const promisePool = pool.promise();

// Simple connection test on startup
promisePool.getConnection()
    .then(connection => {
        console.log("Successfully connected to Aiven MySQL Database!");
        connection.release(); // Always release the connection back to the pool
    })
    .catch(err => {
        console.error("Database Connection Failed:", err.message);
    });

module.exports = promisePool;