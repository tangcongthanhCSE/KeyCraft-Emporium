// File: Frontend/js/profile.js

// ==========================================
// 1. LOAD PROFILE DATA
// ==========================================
async function loadProfile() {
    try {
        const res = await authFetch('/user/profile');
        if (!res.ok) return;

        const data = await res.json();
        const userRole = JSON.parse(localStorage.getItem('user')).role;
        
        // View Data
        document.getElementById('view-username').innerText = data.Username;
        document.getElementById('view-email').innerText = data.Email;
        document.getElementById('view-role').innerText = userRole;
        document.getElementById('view-coin').innerText = data.CoinBalance || 0;
        document.getElementById('view-rank').innerText = data.MembershipLevel || 'Silver';
        
        if (data.Avatar) {
            document.getElementById('view-avatar').src = data.Avatar;
        }

        // Edit Data
        const currentPhone = (data.phones && data.phones.length > 0) ? data.phones[0] : '';
        document.getElementById('edit-phone').value = currentPhone;
        document.getElementById('edit-avatar').value = data.Avatar || '';

        // Addresses
        const addrList = document.getElementById('address-list');
        addrList.innerHTML = '';
        
        if (data.addresses && data.addresses.length > 0) {
            data.addresses.forEach(addr => {
                addrList.innerHTML += `
                    <div class="address-card">
                        <div style="font-weight:bold; margin-bottom:5px;">
                            ${addr.ReceiverName} <span style="font-weight:normal; color:#777">| ${addr.Phone}</span>
                        </div>
                        <div>${addr.Street}, ${addr.District}, ${addr.City}</div>
                        ${addr.IsDefault ? '<div style="color: #ee4d2d; font-size: 12px; margin-top:5px;">[Default]</div>' : ''}
                    </div>
                `;
            });
        } else {
            addrList.innerHTML = '<p style="color: #777; font-style: italic;">No addresses found.</p>';
        }

        // Seller Registration
        if (userRole === 'Buyer') {
            const sellerArea = document.getElementById('seller-regist-area');
            if (sellerArea) sellerArea.classList.remove('hidden');
        }

    } catch (error) {
        console.error(error);
        alert("Failed to load profile.");
    }
}

// ==========================================
// 2. UPDATE PROFILE
// ==========================================
async function updateProfile() {
    const avatar = document.getElementById('edit-avatar').value;
    const phone = document.getElementById('edit-phone').value;

    if (!avatar && !phone) return alert("Please enter Avatar URL or Phone.");

    try {
        const res = await authFetch('/user/profile', {
            method: 'PUT',
            body: JSON.stringify({ avatar, phone })
        });

        if (res.ok) {
            alert("Update successful!");
            loadProfile();
        } else {
            const data = await res.json();
            alert("Error: " + data.error);
        }
    } catch (error) { console.error(error); }
}

// ==========================================
// 3. ADD ADDRESS
// ==========================================
async function addAddress() {
    const name = document.getElementById('addr-name').value;
    const city = document.getElementById('addr-city').value;
    const street = document.getElementById('addr-street').value;
    const currentPhone = document.getElementById('edit-phone').value;

    if (!name || !city || !street) return alert("Please fill all address fields.");
    if (!currentPhone) return alert("Please save your phone number first.");

    try {
        const res = await authFetch('/user/profile', {
            method: 'PUT',
            body: JSON.stringify({
                address: {
                    receiverName: name,
                    phone: currentPhone,
                    city: city,
                    district: "District",
                    street: street,
                    addressType: "Delivery"
                }
            })
        });

        if (res.ok) {
            alert("Address added!");
            document.getElementById('addr-name').value = "";
            document.getElementById('addr-city').value = "";
            document.getElementById('addr-street').value = "";
            loadProfile();
        } else {
            const data = await res.json();
            alert("Error: " + data.error);
        }
    } catch (error) { console.error(error); }
}

// ==========================================
// 4. REGISTER SELLER
// ==========================================
async function registerSeller() {
    const shopName = document.getElementById('shop-name').value;
    const shopDesc = document.getElementById('shop-desc').value;

    if (!shopName) return alert("Please enter Shop Name.");

    try {
        const res = await authFetch('/user/become-seller', {
            method: 'POST',
            body: JSON.stringify({ shopName, shopDescription: shopDesc })
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            const currentUser = JSON.parse(localStorage.getItem('user'));
            currentUser.role = 'Seller';
            localStorage.setItem('user', JSON.stringify(currentUser));
            window.location.reload();
        } else {
            alert("Error: " + data.error);
        }
    } catch (error) { console.error(error); }
}

// ==========================================
// 5. CALCULATE RANK (SQL FUNCTION)
// ==========================================
async function calculateRank() {
    const resultDiv = document.getElementById('calc-rank-result');
    resultDiv.innerHTML = 'Calculating...';

    try {
        const res = await authFetch('/user/membership-status');
        const data = await res.json();

        if (res.ok) {
            resultDiv.innerHTML = `Calculated Rank: ${data.currentRank}`;
            const currentDisplay = document.getElementById('view-rank').innerText;
            if (currentDisplay !== data.currentRank) {
                setTimeout(() => alert(`System calculated your rank as ${data.currentRank}.`), 500);
            }
        } else {
            resultDiv.innerHTML = 'Error';
        }
    } catch (error) {
        console.error(error);
        resultDiv.innerHTML = 'Connection Failed';
    }
}

// ==========================================
// 6. LOAD ORDERS & RATING
// ==========================================
async function loadOrders() {
    const container = document.getElementById('order-list');
    container.innerHTML = '<p>Checking order status...</p>';

    try {
        const res = await authFetch('/user/orders');
        const orders = await res.json();

        if (orders.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#777;">You have no orders yet.</p>';
            return;
        }

        container.innerHTML = orders.map(order => {
            const isDelivered = order.ShipStatus === 'Delivered';
            const statusClass = isDelivered ? 'status-delivered' : 'status-preparing';
            const statusText = isDelivered ? 'Delivered' : 'Preparing/Shipping';
            
            const itemsHtml = order.Items.map(item => `
                <div class="order-item">
                    <img src="${item.ImageURL || 'https://via.placeholder.com/60'}" class="item-img">
                    <div style="flex: 1;">
                        <div style="font-weight: bold;">${item.ProductName}</div>
                        <div style="font-size: 13px; color: #666;">x${item.Quantity}</div>
                    </div>
                    <div style="font-weight: 500;">$${item.UnitPrice}</div>
                    
                    ${(isDelivered && !item.IsRated) ? 
                        `<button class="btn-sm" style="background: #ffc107; color: #333; border: 1px solid #e0a800;" 
                          onclick='openReviewModal(${item.ProductID}, "${item.ProductName}", ${item.OrderDetailID})'>Rate</button>` 
                        : ''}
                    
                    ${item.IsRated ? '<span style="font-size:12px; color:#28a745; font-weight:bold;">✓ Rated</span>' : ''}
                </div>
            `).join('');

            return `
            <div class="order-card">
                <div class="order-header">
                    <span><b>Order #${order.OrderID}</b> | ${new Date(order.OrderDate).toLocaleString()}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="order-body">${itemsHtml}</div>
                <div class="order-footer">
                    <span>Method: ${order.PayMethod}</span>
                    <span style="font-size: 16px;">Total: <b style="color: #ee4d2d;">$${order.FinalTotal}</b></span>
                </div>
            </div>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="color:red">Failed to load orders.</p>';
    }
}

// --- REVIEW MODAL ---
const reviewModal = document.getElementById('review-modal');

function openReviewModal(prodId, prodName, orderDetailId) {
    document.getElementById('review-prod-id').value = prodId;
    document.getElementById('review-order-detail-id').value = orderDetailId;
    document.getElementById('review-prod-name').innerText = "Rate: " + prodName;
    setRating(0);
    reviewModal.classList.add('active');
}

function setRating(stars) {
    document.getElementById('review-score').value = stars;
    const starSpans = document.querySelectorAll('.star-rating span');
    starSpans.forEach((span, index) => {
        if (index < stars) span.classList.add('selected');
        else span.classList.remove('selected');
    });
    const text = ["Select stars", "Bad", "Poor", "Average", "Good", "Excellent"];
    document.getElementById('rating-text').innerText = text[stars] || "";
}

async function submitReview() {
    const prodId = document.getElementById('review-prod-id').value;
    const orderDetailId = document.getElementById('review-order-detail-id').value;
    const rating = document.getElementById('review-score').value;

    if (rating == 0) return alert("Please select stars!");

    try {
        const res = await authFetch('/products/review', {
            method: 'POST',
            body: JSON.stringify({ productId: prodId, rating, orderDetailId })
        });
        
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            closeModal('review-modal');
            loadOrders(); // Refresh to update "Rated" status
        } else {
            alert("Error: " + data.error);
        }
    } catch (error) { console.error(error); }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Init
loadProfile();
loadOrders();