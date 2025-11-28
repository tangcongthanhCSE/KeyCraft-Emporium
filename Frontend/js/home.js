// File: Frontend/js/home.js

// Retrieve user info from LocalStorage
const user = JSON.parse(localStorage.getItem('user'));
const token = localStorage.getItem('token');

// ==================================================================
// 1. AUTHENTICATION & NAVIGATION
// ==================================================================

/**
 * Function: checkAuth
 * Purpose: Update the Navigation Bar based on login status and role.
 */
function checkAuth() {
    const navInfo = document.getElementById('nav-user-info');
    
    if (!token || !user) {
        // Case: Guest (Not logged in)
        navInfo.innerHTML = `<a href="login.html" class="btn-nav">Login / Register</a>`;
    } else {
        // Case: Logged in
        let menuHtml = `<span>Hi, <b>${user.username}</b></span>`;
        
        // Show specific buttons based on Role
        if (user.role === 'Seller') {
            menuHtml += `<a href="seller.html" class="btn-nav">Seller Center</a>`;
        } else if (user.role === 'Admin') {
            menuHtml += `<a href="admin.html" class="btn-nav">Dashboard</a>`;
        }

        // Common buttons
        menuHtml += `<a href="cart.html" class="btn-nav">🛒 Cart</a>`;
        menuHtml += `
            <a href="profile.html" class="btn-nav">My Profile</a>
            <a href="#" class="btn-nav" onclick="logout()">Logout</a>
        `;
        navInfo.innerHTML = menuHtml;
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// ==================================================================
// 2. SEARCH & RENDER LOGIC
// ==================================================================

/**
 * Function: handleSearch
 * Purpose: Fetch products from Backend API based on filters and render them.
 */
async function handleSearch() {
    // Get values from inputs
    const keyword = document.getElementById('search-keyword').value.trim();
    const min = document.getElementById('search-min').value;
    const max = document.getElementById('search-max').value;
    const sort = document.getElementById('search-sort').value; // ASC or DESC
    const listDiv = document.getElementById('product-list');

    listDiv.innerHTML = '<p style="width:100%; text-align:center">Searching...</p>';

    try {
        // Build Query Params
        const params = new URLSearchParams();
        if (keyword) params.append('keyword', keyword);
        if (min) params.append('min', min);
        if (max) params.append('max', max);
        params.append('sort', sort);

        // Call API
        const response = await fetch(`${API_BASE_URL}/products/search?${params.toString()}`);
        const products = await response.json();

        if (!response.ok || products.length === 0) {
            listDiv.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #777;">No products found.</p>';
            return;
        }

        // Render Product Cards
listDiv.innerHTML = products.map(p => {
            const isOwner = user && (user.id === p.SellerID || user.role === 'Admin');
            const conditionTag = p.ConditionState === 'New' ? 'tag-new' : 'tag-used';
            const imgUrl = p.ImageURL || 'https://via.placeholder.com/300x200?text=No+Image';
            const ratingDisplay = p.ProductRating > 0 ? `⭐ ${p.ProductRating}` : '';
            
            // Shop Rating
            const shopRating = p.ShopRating ? `(Shop: ⭐${p.ShopRating})` : '';

            // Xử lý Nút Add to Cart
            let cartBtnClass = 'btn-add-cart';
            // Escape dấu nháy đơn để tránh lỗi JS khi render
            const productJson = JSON.stringify(p).replace(/'/g, "&#39;");
            let cartBtnAction = `onclick='openCartModal(${productJson})'`;
            
            if (!user) {
                // Chưa đăng nhập -> Chuyển sang Login
                cartBtnAction = "onclick='window.location.href=\"login.html\"'";
            } else if (isOwner) {
                // LÀ CHỦ SHOP -> ẨN LUÔN NÚT ADD TO CART
                cartBtnClass += ' hidden'; 
            }

            return `
            <div class="product-card" title="${p.ProductName}">
                <div style="width:100%; height:180px; overflow:hidden; border-radius:4px; margin-bottom:10px; background:#f9f9f9; display:flex; align-items:center; justify-content:center;">
                    <img src="${imgUrl}" style="width:100%; height:100%; object-fit:contain;" alt="${p.ProductName}">
                </div>

                <div class="prod-name">${p.ProductName}</div>
                <div class="prod-price">$${p.BasePrice}</div>
                
                <div class="prod-meta" style="flex-direction: column; gap: 5px; align-items: flex-start;">
                    <div style="display:flex; justify-content:space-between; width:100%">
                        <span>Stock: ${p.StockQuantity}</span>
                        <span class="tag ${conditionTag}">${p.ConditionState}</span>
                    </div>
                    
                    <div style="font-size: 13px; color: #ffc107; font-weight: 500;">
                        ${ratingDisplay}
                    </div>
                </div>
                
                <div class="prod-shop" style="margin-top: auto; padding-top: 10px; border-top: 1px dashed #eee;">
                    🏪 ${p.ShopName} <span style="font-size:11px; color:#999;">${shopRating}</span>
                </div>

                <button class="${cartBtnClass}" ${cartBtnAction} title="Add to Cart">+</button>

                ${isOwner ? `
                <div class="owner-actions" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 5px;">
                    <button class="btn-xs btn-edit" onclick='openEditModal(${productJson})'>Edit</button>
                    <button class="btn-xs btn-delete" onclick="deleteProduct(${p.ProductID})">Delete</button>
                </div>
                ` : ''}
            </div>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        listDiv.innerHTML = '<p style="color:red; text-align:center;">Error loading data from server.</p>';
    }
}

// ==================================================================
// 3. CART MANAGEMENT (NEW FEATURE)
// ==================================================================
const cartModal = document.getElementById('cart-modal');

/**
 * Open the Cart Modal and populate product info
 */
function openCartModal(product) {
    document.getElementById('cart-prod-id').value = product.ProductID;
    document.getElementById('cart-prod-name').innerText = product.ProductName;
    document.getElementById('cart-prod-price').innerText = `$${product.BasePrice}`;
    document.getElementById('cart-prod-stock').innerText = `Stock: ${product.StockQuantity}`;
    document.getElementById('cart-prod-img').src = product.ImageURL || 'https://via.placeholder.com/80';
    
    // Reset Quantity
    const qtyInput = document.getElementById('cart-qty');
    qtyInput.value = 1;
    qtyInput.max = product.StockQuantity; // Set max limit based on stock
    
    cartModal.classList.add('active');
}

/**
 * Adjust quantity using + and - buttons
 */
function adjustQty(amount) {
    const input = document.getElementById('cart-qty');
    let newVal = parseInt(input.value) + amount;
    const max = parseInt(input.max);
    
    if (newVal < 1) newVal = 1;
    if (newVal > max) {
        newVal = max;
        alert("You cannot add more than the available stock!");
    }
    
    input.value = newVal;
}

/**
 * Call API to add item to cart
 */
async function submitAddToCart() {
    const productId = document.getElementById('cart-prod-id').value;
    const quantity = document.getElementById('cart-qty').value;

    try {
        const res = await authFetch('/cart/add', {
            method: 'POST',
            body: JSON.stringify({ 
                productId: productId, 
                quantity: parseInt(quantity) 
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message); // Success message
            closeModal('cart-modal');
        } else {
            alert("Error: " + data.error);
        }

    } catch (error) {
        console.error(error);
        alert("Failed to add to cart.");
    }
}

// ==================================================================
// 4. EDIT & DELETE LOGIC (For Owners)
// ==================================================================

const editModal = document.getElementById('edit-modal');

function openEditModal(product) {
    document.getElementById('edit-id').value = product.ProductID;
    document.getElementById('edit-name').value = product.ProductName;
    document.getElementById('edit-desc').value = product.Description || "";
    document.getElementById('edit-price').value = product.BasePrice;
    document.getElementById('edit-stock').value = product.StockQuantity;
    document.getElementById('edit-weight').value = product.Weight;
    document.getElementById('edit-dim').value = product.Dimensions || "";
    document.getElementById('edit-cond').value = product.ConditionState;
    
    editModal.classList.add('active');
}

async function handleUpdateProduct(event) {
    event.preventDefault();
    const id = document.getElementById('edit-id').value;
    
    const payload = {
        name: document.getElementById('edit-name').value,
        description: document.getElementById('edit-desc').value,
        price: parseFloat(document.getElementById('edit-price').value),
        stock: parseInt(document.getElementById('edit-stock').value),
        weight: parseFloat(document.getElementById('edit-weight').value),
        dimensions: document.getElementById('edit-dim').value,
        condition: document.getElementById('edit-cond').value,
        isPreOrder: false 
    };

    try {
        const res = await authFetch(`/seller/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            alert("Product Updated Successfully!");
            closeModal('edit-modal');
            handleSearch(); // Refresh the grid
        } else {
            alert("Error: " + data.error);
        }
    } catch (error) { console.error(error); }
}

async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
        const res = await authFetch(`/seller/products/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            alert("Product Deleted!");
            handleSearch();
        } else {
            alert("Error: " + data.error);
        }
    } catch (error) { console.error(error); }
}

// ==================================================================
// 5. HELPER FUNCTIONS & INITIALIZATION
// ==================================================================

// Helper to close modals
function closeModal(modalId) {
    // If modalId is passed, close that specific modal
    if (typeof modalId === 'string') {
        document.getElementById(modalId).classList.remove('active');
    } else {
        // If no ID passed (legacy calls), close all active modals
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
}

// Close modal on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// Initialize page
checkAuth();
handleSearch();