// File: js/admin.js

// 1. Security Check: Ensure user is Admin
const user = JSON.parse(localStorage.getItem('user'));
if (!user || user.role !== 'Admin') {
    alert("Access Denied! Admins only.");
    window.location.href = 'index.html';
}

// ==========================================
// USER MANAGEMENT
// ==========================================
async function updateUserStatus() {
    const userId = document.getElementById('ban-user-id').value;
    const status = document.getElementById('ban-status').value;

    if (!userId) return alert("Please enter User ID");

    if (!confirm(`Are you sure you want to set User #${userId} to '${status}'?`)) return;

    try {
        const res = await authFetch('/admin/users/status', {
            method: 'PUT',
            body: JSON.stringify({ userId, status })
        });
        
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
        } else {
            alert("Error: " + data.error);
        }
    } catch (error) {
        console.error(error);
        alert("Server Connection Error");
    }
}