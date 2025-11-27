// File: Frontend/js/home.js

// Retrieve user info from LocalStorage
const user = JSON.parse(localStorage.getItem('user'));
const token = localStorage.getItem('token');

/**
 * Function: checkAuth
 * Purpose: Update the Navigation Bar based on login status.
 */
function checkAuth() {
    const navInfo = document.getElementById('nav-user-info');
    
    if (!token || !user) {
        // Case: Guest (Not logged in)
        navInfo.innerHTML = `<a href="login.html" class="btn-nav">Login / Register</a>`;
    } else {
        // Case: Logged in user
        let menuHtml = `<span>Hi, <b>${user.username}</b></span>`;
        
        // Show specific buttons based on Role
        if (user.role === 'Seller') {
            menuHtml += `<a href="seller.html" class="btn-nav">Seller Center</a>`;
        } else if (user.role === 'Admin') {
            menuHtml += `<a href="admin.html" class="btn-nav">Dashboard</a>`;
        }

        // Common buttons
        menuHtml += `
            <a href="profile.html" class="btn-nav">My Profile</a>
            <a href="#" class="btn-nav" onclick="logout()">Logout</a>
        `;
        navInfo.innerHTML = menuHtml;
    }
}

/**
 * Function: logout
 * Purpose: Clear session and redirect to login.
 */
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

/**
 * Function: handleSearch
 * Purpose: Fetch products from Backend API based on filters.
 */
async function handleSearch() {
    // 1. Get values from input fields
    const keyword = document.getElementById('search-keyword').value.trim();
    const min = document.getElementById('search-min').value;
    const max = document.getElementById('search-max').value;
    const listDiv = document.getElementById('product-list');

    // Show loading state
    listDiv.innerHTML = '<p>Searching...</p>';

    try {
        // 2. Construct Query String
        const params = new URLSearchParams();
        if (keyword) params.append('keyword', keyword);
        if (min) params.append('min', min);
        if (max) params.append('max', max);

        // 3. Call Public API (No Auth Header required for searching)
        // Endpoint matches backend/product.js
        const response = await fetch(`${API_BASE_URL}/products/search?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error("Server responded with error.");
        }

        const products = await response.json();

        // 4. Handle Empty Result
        if (products.length === 0) {
            listDiv.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #777;">No products found matching your criteria.</p>';
            return;
        }

        // 5. Render Product Cards
        listDiv.innerHTML = products.map(p => {
            // Check if Rating exists, otherwise default to N/A
            const ratingDisplay = p.ProductRating > 0 ? `⭐ ${p.ProductRating}` : '';
            const shopRating = p.ShopRating ? `(Shop: ⭐${p.ShopRating})` : '';

            return `
            <div class="product-card" title="${p.ProductName}">
                <div class="prod-name">${p.ProductName}</div>
                <div class="prod-price">$${p.BasePrice}</div>
                
                <div class="prod-meta">
                    <span>Stock: ${p.StockQuantity}</span>
                    <span>${p.ConditionState}</span>
                </div>
                
                <div style="margin-top: 8px; font-size: 13px; color: #555; border-top: 1px dashed #eee; padding-top: 5px;">
                    <span class="prod-shop">🏪 ${p.ShopName}</span> ${shopRating}
                </div>
                <div style="margin-top: 3px; font-size: 13px;">
                    ${ratingDisplay}
                </div>
            </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Search Error:", error);
        listDiv.innerHTML = '<p style="color:red; text-align:center;">Failed to load products. Please check server connection.</p>';
    }
}

// --- Initialization ---
// Run these when the script loads
checkAuth();    // Update UI state
handleSearch(); // Load all products initially (empty filters)