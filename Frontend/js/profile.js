// File: js/profile.js

// 1. Load dữ liệu khi vào trang
async function loadProfile() {
    try {
        const res = await authFetch('/user/profile');
        if (!res.ok) return;

        const data = await res.json();
        
        // Điền dữ liệu vào giao diện
        document.getElementById('view-username').innerText = data.Username;
        document.getElementById('view-email').innerText = data.Email;
        document.getElementById('view-role').innerText = JSON.parse(localStorage.getItem('user')).role;
        document.getElementById('view-coin').innerText = data.CoinBalance || 0;
        document.getElementById('view-rank').innerText = data.MembershipLevel || 'Silver';
        
        if (data.Avatar) document.getElementById('view-avatar').src = data.Avatar;

        // Điền vào ô input để user sửa
        document.getElementById('edit-phone').value = (data.phones && data.phones[0]) || '';
        document.getElementById('edit-avatar').value = data.Avatar || '';

        // Render danh sách địa chỉ
        const addrList = document.getElementById('address-list');
        addrList.innerHTML = '';
        if (data.addresses) {
            data.addresses.forEach(addr => {
                addrList.innerHTML += `
                    <div class="address-card">
                        <b>${addr.ReceiverName}</b> - ${addr.Phone} <br>
                        ${addr.Street}, ${addr.District}, ${addr.City} 
                        <span style="color: #ee4d2d; font-size: 12px">${addr.IsDefault ? '(Mặc định)' : ''}</span>
                    </div>
                `;
            });
        }

        // Kiểm tra: Nếu chưa là Seller thì hiện form đăng ký
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser.role === 'Buyer') {
            document.getElementById('seller-regist-area').classList.remove('hidden');
        }

    } catch (error) {
        console.error(error);
        alert("Không thể tải thông tin hồ sơ");
    }
}

// 2. Cập nhật Avatar/Phone
async function updateProfile() {
    const avatar = document.getElementById('edit-avatar').value;
    const phone = document.getElementById('edit-phone').value;

    try {
        const res = await authFetch('/user/profile', {
            method: 'PUT',
            body: JSON.stringify({ avatar, phone })
        });

        if (res.ok) {
            alert("Cập nhật thành công!");
            loadProfile(); // Load lại trang
        } else {
            alert("Lỗi cập nhật");
        }
    } catch (error) {
        console.error(error);
    }
}

// 3. Thêm địa chỉ mới
async function addAddress() {
    const name = document.getElementById('addr-name').value;
    const city = document.getElementById('addr-city').value;
    const street = document.getElementById('addr-street').value;

    if (!name || !city || !street) {
        alert("Vui lòng nhập đủ thông tin địa chỉ");
        return;
    }

    try {
        const res = await authFetch('/user/profile', {
            method: 'PUT',
            body: JSON.stringify({
                address: {
                    receiverName: name,
                    city: city,
                    district: "Quận Mới", // Tạm thời hardcode
                    street: street
                }
            })
        });

        if (res.ok) {
            alert("Thêm địa chỉ thành công!");
            loadProfile();
        }
    } catch (error) {
        console.error(error);
    }
}

// 4. Đăng ký làm Seller
async function registerSeller() {
    const shopName = document.getElementById('shop-name').value;
    const shopDesc = document.getElementById('shop-desc').value;

    if (!shopName) {
        alert("Vui lòng nhập tên Shop");
        return;
    }

    try {
        const res = await authFetch('/user/become-seller', {
            method: 'POST',
            body: JSON.stringify({ shopName, shopDescription: shopDesc })
        });

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            // Cập nhật Role trong LocalStorage để user không cần login lại
            const currentUser = JSON.parse(localStorage.getItem('user'));
            currentUser.role = 'Seller';
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // Reload để ẩn form đăng ký
            window.location.reload();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error(error);
        alert("Lỗi đăng ký Shop");
    }
}

// Chạy ngay khi load script
loadProfile();