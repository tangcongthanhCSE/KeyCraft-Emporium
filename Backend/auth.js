// File: auth.js
const express = require('express');
const db = require('./db');
const jwt = require('jsonwebtoken');
const router = express.Router();
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'keycraft_secret_key_2024';

// ==================================================================
// API: REGISTER A NEW USER
// Endpoint: POST /api/auth/register
// Description: Creates a new USERS record and a corresponding BUYER record.
// ==================================================================
router.post('/register', async (req, res) => {
    const { username, email, password, phone } = req.body;

    // 1. Basic Validation
    if (!username || !email || !password) {
        return res.status(400).json({ error: "Missing required fields: username, email, or password." });
    }

    let connection;
    try {
        // Get a specific connection to start a transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 2. Check for duplicate Username or Email
        const [existingUser] = await connection.query(
            'SELECT UserID FROM USERS WHERE Username = ? OR Email = ?', 
            [username, email]
        );
        
        if (existingUser.length > 0) {
            await connection.rollback(); // Cancel transaction
            return res.status(409).json({ error: "Username or Email already exists!" });
        }

        // 3. Insert into 'USERS' table (Superclass)
        // NOTE: Storing password in PLAIN TEXT for testing purposes as requested.
        const [userResult] = await connection.query(
            'INSERT INTO USERS (Username, Email, Password, Status) VALUES (?, ?, ?, ?)',
            [username, email, password, 'Active'] 
        );
        const newUserID = userResult.insertId;

        // 4. Insert into 'BUYER' table (Subclass)
        // Default Logic: Every new user starts as a Silver Buyer with 0 Coin.
        await connection.query(
            'INSERT INTO BUYER (UserID, CoinBalance, MembershipLevel) VALUES (?, ?, ?)',
            [newUserID, 0, 'Silver']
        );

        // 5. Insert Phone Number (Optional) into 'USER_PHONE' table
        if (phone) {
            await connection.query(
                'INSERT INTO USER_PHONE (UserID, PhoneNumber) VALUES (?, ?)',
                [newUserID, phone]
            );
        }

        await connection.commit(); // Commit transaction to database
        
        res.status(201).json({ 
            message: "Registration successful! You can login now.", 
            userId: newUserID,
            role: "Buyer" 
        });

    } catch (error) {
        if (connection) await connection.rollback(); // Rollback on error
        console.error("Registration Error:", error);
        res.status(500).json({ error: "Internal Server Error: " + error.message });
    } finally {
        if (connection) connection.release(); // Release connection back to pool
    }
});

// ==================================================================
// API: LOGIN
// Endpoint: POST /api/auth/login
// Description: Authenticates user and determines their role (Admin/Seller/Buyer).
// ==================================================================
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and Password are required." });
    }

    try {
        // 1. Find User in 'USERS' table
        const [users] = await db.query('SELECT * FROM USERS WHERE Username = ?', [username]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        const user = users[0];

        // 2. Verify Password (Plain Text Comparison)
        // NOTE: This is for testing. In production, use bcrypt.compare().
        if (password !== user.Password) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        // 3. Check Account Status
        if (user.Status === 'Banned') {
            return res.status(403).json({ error: "This account has been banned." });
        }

        // 4. Determine User Role (Hierarchy Check)
        // Priority: Admin > Seller > Buyer
        let role = 'Buyer'; // Default role
        let roleData = {};

        // Check if user is an ADMIN
        const [admins] = await db.query('SELECT PermissionLevel, Role FROM ADMIN WHERE UserID = ?', [user.UserID]);
        
        if (admins.length > 0) {
            role = 'Admin';
            roleData = admins[0];
        } else {
            // Check if user is a SELLER
            const [sellers] = await db.query('SELECT ShopName, Rating FROM SELLER WHERE UserID = ?', [user.UserID]);
            if (sellers.length > 0) {
                role = 'Seller';
                roleData = sellers[0];
            } else {
                // If not Admin or Seller, get Buyer details
                const [buyers] = await db.query('SELECT CoinBalance, MembershipLevel FROM BUYER WHERE UserID = ?', [user.UserID]);
                if (buyers.length > 0) {
                    role = 'Buyer';
                    roleData = buyers[0];
                }
            }
        }

        // 5. Generate JWT Token
        const token = jwt.sign(
            { 
                id: user.UserID, 
                username: user.Username, 
                role: role // Embed role in token for frontend logic
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 6. Send Response
        res.json({
            message: `Welcome back, ${role}!`,
            token: token,
            user: {
                id: user.UserID,
                username: user.Username,
                email: user.Email,
                role: role,
                details: roleData // Specific data based on role (e.g., ShopName for Seller)
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;