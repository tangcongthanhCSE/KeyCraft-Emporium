// File: Frontend/js/seller.js

// 1. Security Check: Ensure user is Seller
const user = JSON.parse(localStorage.getItem('user'));
if (!user || user.role !== 'Seller') {
    alert("Access Denied! Sellers only.");
    window.location.href = 'index.html';
}

// 2. Initialize Defaults
document.addEventListener('DOMContentLoaded', () => {
    // Set default dates for analytics (First day and Last day of current month)
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    
    document.getElementById('report-start').value = firstDay;
    document.getElementById('report-end').value = lastDay;

    // Load Data
    loadMyProducts();
});

// ==========================================
// ANALYTICS LOGIC (New)
// ==========================================
async function loadAnalytics() {
    const start = document.getElementById('report-start').value;
    const end = document.getElementById('report-end').value;
    const minSold = document.getElementById('report-min').value;
    const tbody = document.getElementById('analytics-body');
    const tfoot = document.getElementById('analytics-footer');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Loading report...</td></tr>';
    tfoot.innerHTML = '';

    try {
        // Call Backend API -> Calls Stored Procedure
        const res = await authFetch(`/seller/analytics?start=${start}&end=${end}&minSold=${minSold}`);
        
        if (!res.ok) throw new Error("Failed to fetch report");

        const json = await res.json();
        const data = json.data || [];

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No sales data found for this period.</td></tr>';
            return;
        }

        // Render Table Rows
        let grandTotalRevenue = 0;
        tbody.innerHTML = data.map(item => {
            grandTotalRevenue += parseFloat(item.TotalRevenue);
            return `
            <tr>
                <td><b>${item.ProductName}</b></td>
                <td>⭐ ${item.ProductRating || '0.0'}</td>
                <td>${item.TotalOrders}</td>
                <td>${item.TotalUnitsSold}</td>
                <td style="color: var(--primary-color); font-weight: bold;">$${item.TotalRevenue}</td>
            </tr>
            `;
        }).join('');

        // Render Footer Summary
        tfoot.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: right;">TOTAL REVENUE:</td>
                <td style="color: var(--primary-color); font-size: 16px;">$${grandTotalRevenue.toFixed(2)}</td>
            </tr>
        `;

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading data.</td></tr>';
    }
}

// ==========================================
// PRODUCT MANAGEMENT LOGIC
// ==========================================

async function loadMyProducts() {
    const tbody = document.getElementById('product-table-body');
    tbody.innerHTML = '<tr><td colspan="6">Loading products...</td></tr>';

    try {
        const res = await authFetch('/seller/products');
        const products = await res.json();

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">You have no products. Add one!</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>#${p.ProductID}</td>
                <td><b>${p.Name}</b></td>
                <td>$${p.BasePrice}</td>
                <td>${p.StockQuantity}</td>
                <td><span style="padding: 2px 6px; background: #eee; border-radius: 3px; font-size: 11px;">${p.ConditionState}</span></td>
                <td>
                    <button class="btn-sm btn-edit" onclick='openEditModal(${JSON.stringify(p)})'>Edit</button>
                    <button class="btn-sm btn-delete" onclick="deleteProduct(${p.ProductID})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error(error);
        alert("Error loading products");
    }
}

// --- MODAL HANDLERS ---
const modal = document.getElementById('product-modal');

function openModal() {
    document.getElementById('modal-title').innerText = "Add New Product";
    document.getElementById('prod-id').value = "";
    // Reset form
    document.getElementById('prod-name').value = "";
    document.getElementById('prod-desc').value = "";
    document.getElementById('prod-price').value = "";
    document.getElementById('prod-stock').value = "";
    document.getElementById('prod-weight').value = "";
    document.getElementById('prod-dim').value = "";
    document.getElementById('prod-cond').value = "New";
    document.getElementById('prod-preorder').checked = false;
    
    modal.classList.add('active');
}

function openEditModal(product) {
    document.getElementById('modal-title').innerText = "Edit Product #" + product.ProductID;
    document.getElementById('prod-id').value = product.ProductID;
    
    // Fill existing data
    document.getElementById('prod-name').value = product.Name;
    document.getElementById('prod-desc').value = product.Description;
    document.getElementById('prod-price').value = product.BasePrice;
    document.getElementById('prod-stock').value = product.StockQuantity;
    document.getElementById('prod-weight').value = product.Weight;
    document.getElementById('prod-dim').value = product.Dimensions;
    document.getElementById('prod-cond').value = product.ConditionState;
    document.getElementById('prod-preorder').checked = product.IsPreOrder === 1;

    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
}

// --- ACTION HANDLERS ---

async function handleSaveProduct(event) {
    event.preventDefault();

    const id = document.getElementById('prod-id').value;
    const isEdit = id !== "";

    const payload = {
        name: document.getElementById('prod-name').value,
        description: document.getElementById('prod-desc').value,
        price: parseFloat(document.getElementById('prod-price').value),
        stock: parseInt(document.getElementById('prod-stock').value),
        weight: parseFloat(document.getElementById('prod-weight').value),
        dimensions: document.getElementById('prod-dim').value,
        condition: document.getElementById('prod-cond').value,
        isPreOrder: document.getElementById('prod-preorder').checked
    };

    try {
        let res;
        if (isEdit) {
            res = await authFetch(`/seller/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            res = await authFetch('/seller/products', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json();

        if (res.ok) {
            alert(isEdit ? "Product Updated!" : "Product Created!");
            closeModal();
            loadMyProducts();
        } else {
            alert("Error: " + data.error);
        }

    } catch (error) {
        console.error(error);
        alert("Connection Error");
    }
}

async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
        const res = await authFetch(`/seller/products/${id}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();

        if (res.ok) {
            alert("Product Deleted!");
            loadMyProducts();
        } else {
            alert("Cannot delete: " + data.error);
        }
    } catch (error) {
        console.error(error);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}