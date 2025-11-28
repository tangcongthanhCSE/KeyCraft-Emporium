// File: Frontend/js/cart.js

// ==================================================================
// 1. LOAD CART ITEMS
// ==================================================================
async function loadCart() {
    const tbody = document.getElementById('cart-body');
    const checkAll = document.getElementById('check-all');
    
    // Reset UI
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Loading cart...</td></tr>';
    document.getElementById('cart-total').innerText = '$0.00';
    checkAll.checked = false;

    try {
        const res = await authFetch('/cart');
        const items = await res.json();

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 50px; color: #777;">Your cart is empty. <a href="index.html">Go shopping</a></td></tr>';
            return;
        }

        // Render Items
        tbody.innerHTML = items.map(item => {
            const itemTotal = item.BasePrice * item.Quantity;
            
            // We store product ID and row price in data attributes for easy calculation
            return `
                <tr>
                    <td>
                        <input type="checkbox" class="cart-checkbox" 
                               data-id="${item.ProductID}" 
                               data-price="${itemTotal}" 
                               onclick="updateTotal()">
                    </td>
                    <td>
                        <div style="display: flex; gap: 15px; align-items: center;">
                            <img src="${item.ImageURL || 'https://via.placeholder.com/60'}" class="cart-img">
                            <div>
                                <div style="font-weight: bold; color: #333;">${item.Name}</div>
                                <div style="font-size: 12px; color: #888;">Shop: ${item.ShopName}</div>
                            </div>
                        </div>
                    </td>
                    <td>$${item.BasePrice}</td>
                    <td>${item.Quantity}</td>
                    <td style="color: var(--primary-color); font-weight: bold;">$${itemTotal.toFixed(2)}</td>
                    <td>
                        <button style="color: #dc3545; background: none; border: none; cursor: pointer; text-decoration: underline;" 
                                onclick="removeItem(${item.ProductID})">
                            Remove
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Recalculate total (should be 0 initially as nothing is checked)
        updateTotal();

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red">Failed to load cart. Please try again.</td></tr>';
    }
}

// ==================================================================
// 2. SELECTION & TOTAL CALCULATION
// ==================================================================

/**
 * Handles "Select All" checkbox behavior
 */
function toggleAllItems(source) {
    const checkboxes = document.querySelectorAll('.cart-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateTotal();
}

/**
 * Calculates total price based on selected checkboxes
 */
function updateTotal() {
    const checkboxes = document.querySelectorAll('.cart-checkbox:checked');
    let total = 0;
    
    checkboxes.forEach(cb => {
        const price = parseFloat(cb.getAttribute('data-price'));
        if (!isNaN(price)) {
            total += price;
        }
    });

    document.getElementById('cart-total').innerText = `$${total.toFixed(2)}`;
}

// ==================================================================
// 3. REMOVE ITEM
// ==================================================================
async function removeItem(productId) {
    if (!confirm("Are you sure you want to remove this item from your cart?")) return;

    try {
        const res = await authFetch(`/cart/remove/${productId}`, {
            method: 'DELETE'
        });

        const data = await res.json();

        if (res.ok) {
            // Reload the cart to reflect changes
            loadCart(); 
        } else {
            alert("Error: " + (data.error || "Unknown error"));
        }
    } catch (error) {
        console.error(error);
        alert("Failed to remove item. Check console for details.");
    }
}

// ==================================================================
// 4. CHECKOUT MODAL & PAYMENT
// ==================================================================
const modal = document.getElementById('checkout-modal');

function openCheckoutModal() {
    // Check if any item is selected
    const selectedCount = document.querySelectorAll('.cart-checkbox:checked').length;
    if (selectedCount === 0) {
        return alert("Please select at least one item to checkout.");
    }
    
    // Load addresses before showing modal
    loadAddresses();
    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
}

/**
 * UI logic for selecting payment method
 */
function selectPayment(method, element) {
    // 1. Reset visual styles
    document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('selected'));
    // 2. Highlight clicked option
    element.classList.add('selected');
    // 3. Check the radio button
    element.querySelector('input').checked = true;

    // 4. Toggle Card Form visibility
    const cardForm = document.getElementById('card-form');
    if (method === 'CreditCard') {
        cardForm.style.display = 'block';
    } else {
        cardForm.style.display = 'none';
    }
}

/**
 * Load user addresses into the dropdown
 */
async function loadAddresses() {
    const select = document.getElementById('address-select');
    select.innerHTML = '<option>Loading addresses...</option>';

    try {
        const res = await authFetch('/user/profile');
        const data = await res.json();
        
        if (data.addresses && data.addresses.length > 0) {
            select.innerHTML = data.addresses.map(addr => 
                `<option value="${addr.AddressID}">${addr.ReceiverName} - ${addr.Street}, ${addr.City}</option>`
            ).join('');
        } else {
            select.innerHTML = '<option value="">No address found. Please add one in Profile.</option>';
        }
    } catch (error) { 
        console.error(error);
        select.innerHTML = '<option value="">Error loading addresses</option>';
    }
}

// ==================================================================
// 5. PROCESS CHECKOUT
// ==================================================================
async function processCheckout() {
    const addressId = document.getElementById('address-select').value;
    if (!addressId) {
        return alert("Please select a shipping address. If empty, go to Profile to add one.");
    }

    // Get Payment Method
    const paymentMethod = document.querySelector('input[name="paymethod"]:checked').value;

    // Basic Card Validation (Simulation)
    if (paymentMethod === 'CreditCard') {
        const inputs = document.querySelectorAll('#card-form input');
        let isFilled = true;
        inputs.forEach(i => { if(!i.value.trim()) isFilled = false; });
        
        if (!isFilled) return alert("Please fill in all Credit Card details.");
    }

    // Get Selected Items
    const selectedCheckboxes = document.querySelectorAll('.cart-checkbox:checked');
    const selectedItems = Array.from(selectedCheckboxes).map(cb => ({
        productId: parseInt(cb.getAttribute('data-id'))
    }));

    // Call API
    try {
        const res = await authFetch('/cart/checkout', {
            method: 'POST',
            body: JSON.stringify({ 
                addressId: addressId, 
                paymentMethod: paymentMethod,
                items: selectedItems // Send list of selected ProductIDs
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert("Order placed successfully! Thank you for shopping.");
            window.location.href = 'profile.html'; // Redirect to profile to see order status
        } else {
            alert("Checkout Failed: " + data.error);
        }

    } catch (error) {
        console.error(error);
        alert("Failed to process checkout. Please check your connection.");
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}

// Initialize page
loadCart();