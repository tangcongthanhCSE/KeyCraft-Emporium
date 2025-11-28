// File: Frontend/js/seller.js

// 1. Security Check: Ensure user is Seller
const user = JSON.parse(localStorage.getItem('user'));
if (!user || user.role !== 'Seller') {
    alert("You do not have access to the Seller Channel!");
    window.location.href = 'index.html';
}

// 2. Initialize Defaults & Load Data
document.addEventListener('DOMContentLoaded', () => {
    // Set default dates for analytics (First day and Last day of current month)
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const startInput = document.getElementById('report-start');
    const endInput = document.getElementById('report-end');
    
    if (startInput && endInput) {
        startInput.value = firstDay;
        endInput.value = lastDay;
    }
    
    // Set default month for calculator
    const calcMonth = document.getElementById('calc-month');
    if (calcMonth) calcMonth.value = date.getMonth() + 1;

    // Load Product List
    loadMyProducts();
});

// ==========================================
// ANALYTICS LOGIC (STORED PROCEDURE 2.3)
// ==========================================
// File: Frontend/js/seller.js

async function loadAnalytics() {
    const start = document.getElementById('report-start').value;
    const end = document.getElementById('report-end').value;
    const minSold = document.getElementById('report-min').value;
    
    const tbody = document.getElementById('analytics-body');
    const tfoot = document.getElementById('analytics-footer');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Loading report...</td></tr>';
    tfoot.innerHTML = '';

    try {
        const res = await authFetch(`/seller/analytics?start=${start}&end=${end}&minSold=${minSold}`);
        
        if (!res.ok) throw new Error("Failed to fetch report");

        const json = await res.json();
        const data = json.data || [];

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No sales data found.</td></tr>';
            return;
        }

        // Tính tổng trước khi render để đảm bảo chính xác
        let grandTotalRevenue = 0;
        
        // Render Table Rows
        const rowsHtml = data.map(item => {
            // Ép kiểu số an toàn (tránh null/undefined)
            const revenue = parseFloat(item.TotalRevenue || 0);
            const rating = parseFloat(item.ProductRating || 0);
            
            grandTotalRevenue += revenue;

            return `
            <tr>
                <td><b>${item.ProductName}</b></td>
                <td><span style="color: #ffc107;">★</span> ${rating.toFixed(1)}</td>
                <td style="text-align: center;">${item.TotalOrders}</td>
                <td style="text-align: center;">${item.TotalUnitsSold}</td>
                <td style="color: var(--primary-color); font-weight: bold;">$${revenue.toFixed(2)}</td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;

        // Render Footer Summary
        tfoot.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: right; padding-right: 15px;">TOTAL REVENUE:</td>
                <td style="color: var(--primary-color); font-size: 16px; font-weight: bold;">$${grandTotalRevenue.toFixed(2)}</td>
            </tr>
        `;

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading data.</td></tr>';
    }
}

// ==========================================
// REVENUE CALCULATOR (SQL FUNCTION 2.4)
// ==========================================
async function calculateRevenue() {
    const month = document.getElementById('calc-month').value;
    const year = document.getElementById('calc-year').value;
    const resultSpan = document.getElementById('calc-revenue-result');

    resultSpan.innerText = "Calculating...";
    resultSpan.style.color = "#999";

    try {
        // Call Backend API -> Calls SQL Function fn_CalculateShopMonthlyRevenue
        const res = await authFetch(`/seller/monthly-revenue?month=${month}&year=${year}`);
        const data = await res.json();

        if (res.ok) {
            const revenue = parseFloat(data.revenue).toFixed(2);
            resultSpan.innerText = `$${revenue}`;
            resultSpan.style.color = "#28a745";
        } else {
            resultSpan.innerText = "Error";
            resultSpan.style.color = "red";
            alert(data.error);
        }
    } catch (error) {
        console.error(error);
        resultSpan.innerText = "Failed";
        resultSpan.style.color = "red";
    }
}

// ==========================================
// PRODUCT MANAGEMENT LOGIC (CRUD)
// ==========================================

async function loadMyProducts() {
    const tbody = document.getElementById('product-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Loading product list...</td></tr>';

    try {
        const res = await authFetch('/seller/products');
        const products = await res.json();

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px;">You have no products yet. Add some!</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>#${p.ProductID}</td>
                <td>
                    <div style="font-weight: bold; color: #333;">${p.Name}</div>
                    <div style="font-size: 12px; color: #888;">${p.Description || ''}</div>
                </td>
                <td style="font-weight: 500;">$${p.BasePrice}</td>
                <td>${p.StockQuantity}</td>
                <td>
                    <span style="padding: 3px 8px; background: ${p.ConditionState === 'New' ? '#e6f4ea' : '#fff8e1'}; color: ${p.ConditionState === 'New' ? '#1e7e34' : '#f0a500'}; border-radius: 10px; font-size: 11px; font-weight: bold;">
                        ${p.ConditionState}
                    </span>
                </td>
                <td>
                    <button class="btn-sm btn-edit" onclick='openEditModal(${JSON.stringify(p)})'>Edit</button>
                    <button class="btn-sm btn-delete" onclick="deleteProduct(${p.ProductID})">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red">Failed to connect to server</td></tr>';
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
    
    // Fill data
    document.getElementById('prod-name').value = product.Name;
    document.getElementById('prod-desc').value = product.Description;
    document.getElementById('prod-price').value = product.BasePrice;
    document.getElementById('prod-stock').value = product.StockQuantity;
    document.getElementById('prod-weight').value = product.Weight;
    document.getElementById('prod-dim').value = product.Dimensions;
    document.getElementById('prod-cond').value = product.ConditionState;
    document.getElementById('prod-preorder').checked = product.IsPreOrder === 1; // MySQL boolean is 1/0

    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
}

// --- ACTION HANDLERS (Add/Edit/Delete) ---

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
            // Call SP 2.1 Update
            res = await authFetch(`/seller/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            // Call SP 2.1 Insert
            res = await authFetch('/seller/products', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json();

        if (res.ok) {
            alert(isEdit ? "Product updated successfully!" : "Product added successfully!");
            closeModal();
            loadMyProducts(); // Refresh list
        } else {
            alert("Error: " + data.error);
        }

    } catch (error) {
        console.error(error);
        alert("Server connection error");
    }
}

async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return;

    try {
        // Call SP 2.1 Delete
        const res = await authFetch(`/seller/products/${id}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();

        if (res.ok) {
            alert("Product deleted successfully!");
            loadMyProducts();
        } else {
            alert("Cannot delete: " + data.error);
        }
    } catch (error) {
        console.error(error);
        alert("Server connection error");
    }
}

// Close modal when clicking outside content
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}