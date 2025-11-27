// File: js/config.js
const API_BASE_URL = 'http://localhost:5000/api';

// Hàm hỗ trợ gọi API có xác thực
async function authFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
    });

    // Nếu token hết hạn (401/403), tự động đăng xuất
    if (response.status === 401 || response.status === 403) {
        alert("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    return response;
}