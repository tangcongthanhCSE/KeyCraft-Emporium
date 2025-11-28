// File: js/auth.js

// Chuyển đổi giữa form Login và Register
function toggleAuth() {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    
    if (loginForm.classList.contains('hidden')) {
        loginForm.classList.remove('hidden');
        regForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        regForm.classList.remove('hidden');
    }
}

// Xử lý Đăng Ký
async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, phone })
        });

        const data = await response.json();

        if (response.ok) {
            alert("Registration successful! Please log in.");
            toggleAuth(); // Switch to login form
        } else {
            alert(data.error || "Registration failed");
        }
    } catch (error) {
        console.error(error);
        alert("Lỗi kết nối server");
    }
}

// Xử lý Đăng Nhập
async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // 1. Lưu Token và thông tin User vào LocalStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            alert("Login successfully!");

            // 2. Phân quyền chuyển hướng (Redirect)
            const role = data.user.role;
            if (role === 'Admin') {
                window.location.href = 'admin.html';
            } else {
                // Buyer hoặc Seller đều về trang chủ
                window.location.href = 'index.html';
            }
        } else {
            alert(data.error || "Incorrect username or password");
        }
    } catch (error) {
        console.error(error);
        alert("Server connection error");
    }
}