Dưới đây là file **README.md** chi tiết dành cho Frontend Developer. Bạn hãy lưu nội dung này vào file `README_FRONTEND.md` và gửi cho bạn của bạn.

Nó bao gồm mô tả màn hình (UI), luồng đi (Flow) và đặc tả API (Request/Response) chính xác theo code Backend chúng ta đã xây dựng.

-----

# 📘 Frontend Implementation Guide - KeyCraft Emporium

Tài liệu này mô tả chi tiết cấu trúc các trang web cần xây dựng, luồng nghiệp vụ và cách tích hợp API cho module **Xác thực (Auth)** và **Người dùng (User)**.

## 🛠 Cấu hình chung (Configuration)

Trước khi bắt đầu, hãy cấu hình `axios` hoặc `fetch` với thông số sau:

  * **Backend Base URL:** `http://localhost:4000/api`
  * **Authentication:**
      * Hệ thống sử dụng **JWT (JSON Web Token)**.
      * Sau khi đăng nhập thành công, **bắt buộc** phải lưu `token` vào `localStorage` hoặc `Cookies`.
      * Mọi request gọi đến API (trừ Đăng ký/Đăng nhập) đều phải đính kèm Header:
        ```text
        Authorization: Bearer <your_token_string>
        ```

-----

## 1️⃣ Trang Đăng Ký & Đăng Nhập (Auth Page)

### A. Chức năng Đăng Ký (Register)

  * **UI:** Form gồm các trường: `Username`, `Email`, `Password`, `Phone` (Số điện thoại).
  * **Logic:**
      * Mặc định tài khoản tạo ra sẽ có quyền **Buyer**.
      * User nhập xong -\> Gọi API -\> Nếu thành công thì chuyển sang form Đăng nhập.

#### 🔗 API: `POST /auth/register`

**Body (JSON):**

```json
{
    "username": "nguyenvana",
    "email": "vana@gmail.com",
    "password": "password123",
    "phone": "0901234567"
}
```

**Response:**

  * **201 Created:** `{ "message": "Đăng ký thành công!", ... }`
  * **409 Conflict:** `{ "error": "Username hoặc Email đã tồn tại!" }`

-----

### B. Chức năng Đăng Nhập (Login)

  * **UI:** Form gồm `Username`, `Password` và nút **"Đăng Nhập"**.
  * **Logic Quan Trọng (Phân quyền):**
    1.  Gọi API Login.
    2.  Nhận về `token` và `user.role`.
    3.  **Lưu token** vào Storage.
    4.  **Kiểm tra `role` để chuyển hướng (Redirect):**
          * Nếu `role` === `'Admin'` ➡ Chuyển tới trang **Admin Dashboard**.
          * Nếu `role` === `'Buyer'` hoặc `'Seller'` ➡ Chuyển tới trang **Trang Chủ (Home)**.

#### 🔗 API: `POST /auth/login`

**Body (JSON):**

```json
{
    "username": "nguyenvana",
    "password": "password123"
}
```

**Response (200 OK):**

```json
{
    "message": "Đăng nhập thành công!",
    "token": "eyJhbGciOiJIUz...",  <-- LƯU CÁI NÀY
    "user": {
        "id": 10,
        "username": "nguyenvana",
        "role": "Buyer",             <-- DÙNG CÁI NÀY ĐỂ REDIRECT
        "details": { ... }
    }
}
```

  * **Lỗi 401:** Sai tài khoản hoặc mật khẩu.
  * **Lỗi 403:** Tài khoản bị khóa (Banned).

-----

## 2️⃣ Trang Chủ (Home Page) - Dành cho Buyer & Seller

Trang này hiển thị sau khi Buyer hoặc Seller đăng nhập thành công.

  * **UI Requirement:**
      * Hiển thị danh sách sản phẩm (Layout lưới).
      * **Header (Thanh điều hướng):**
          * Logo.
          * Thanh tìm kiếm.
          * **Nút "Profile" (Hồ sơ cá nhân):** Bắt buộc có. Khi bấm vào sẽ chuyển sang trang `/profile`.
          * Nút "Đăng xuất".

-----

## 3️⃣ Trang Hồ sơ Cá nhân (User Profile)

Trang này dùng để xem và cập nhật thông tin cá nhân. Áp dụng cho cả Buyer và Seller.

### A. Hiển thị thông tin (Load Data)

  * **Sự kiện:** Gọi API ngay khi trang vừa load (`useEffect` trong React).
  * **UI:** Hiển thị Avatar, Username, Email, Số dư xu (Coin), Hạng thành viên (Rank), Số điện thoại và Danh sách địa chỉ giao hàng.

#### 🔗 API: `GET /user/profile`

  * **Header:** `Authorization: Bearer <token>`

**Response (200 OK):**

```json
{
    "UserID": 10,
    "Username": "nguyenvana",
    "Email": "vana@gmail.com",
    "Avatar": "http://link-anh.com/a.jpg",
    "CoinBalance": 0,
    "MembershipLevel": "Silver",
    "phones": ["0901234567"],
    "addresses": [
        { "AddressID": 1, "City": "HCM", "Street": "Nguyen Hue", ... }
    ]
}
```

-----

### B. Cập nhật Avatar & Số điện thoại

  * **UI:** Ô input nhập link ảnh Avatar mới, ô nhập Số điện thoại mới.
  * **Nút bấm:** `[Lưu Thay Đổi]`

#### 🔗 API: `PUT /user/profile`

  * **Header:** `Authorization: Bearer <token>`
  * **Body (JSON):** (Gửi những trường cần sửa)

<!-- end list -->

```json
{
    "avatar": "https://imgur.com/new-avatar.png",
    "phone": "0999888777"
}
```

-----

### C. Thêm Địa chỉ Giao hàng

  * **UI:** Một Form hoặc Popup "Thêm địa chỉ mới".
  * **Các trường:** Tên người nhận, SĐT người nhận, Tỉnh/TP, Quận/Huyện, Tên đường/Số nhà.
  * **Nút bấm:** `[Thêm Địa Chỉ]`

#### 🔗 API: `PUT /user/profile`

  * **Header:** `Authorization: Bearer <token>`
  * **Body (JSON):**

<!-- end list -->

```json
{
    "address": {
        "receiverName": "Nguyen Van A",
        "phone": "0912345678",
        "city": "Ha Noi",
        "district": "Cau Giay",
        "street": "123 Xuan Thuy",
        "addressType": "Delivery"
    }
}
```

-----

## 4️⃣ Trang Admin Dashboard (Dành riêng cho Admin)

Trang này chỉ hiện ra nếu khi đăng nhập `user.role === 'Admin'`.

  * **Hiện trạng:** API cho phần này **CHƯA HIỆN THỰC**.
  * **Yêu cầu UI (Frontend only):**
      * Tạo một trang Dashboard cơ bản.
      * Có Sidebar hoặc Menu chứa các nút chức năng sau (nhưng chưa cần gắn API, chỉ cần log ra console khi bấm):
        1.  **Quản lý User:** (Nút Ban/Unban user).
        2.  **Quản lý Voucher:** (Nút Tạo/Sửa/Xóa Voucher).
        3.  **Duyệt bài đăng:** (Duyệt sản phẩm của Seller).
        4.  **Thống kê:** (Xem doanh thu toàn sàn).

-----

## ⚡️ Tóm tắt Luồng người dùng (User Flow)

1.  **Khách:** Vào trang Web -\> Thấy nút Đăng nhập/Đăng ký.
2.  **Đăng ký:** Nhập thông tin -\> Gọi API -\> Thành công -\> Chuyển sang Login.
3.  **Đăng nhập:**
      * Nhập User/Pass -\> Gọi API.
      * **Thành công:** Lưu Token.
      * **Kiểm tra Role:**
          * Là **Admin** -\> Chuyển hướng sang **Dashboard**.
          * Là **Buyer/Seller** -\> Chuyển hướng sang **Home**.
4.  **Tại Home (Buyer/Seller):**
      * Click vào Avatar/Tên -\> Vào trang **Profile**.
      * Tại Profile -\> Gọi API `GET` để xem info -\> Nhập data mới -\> Gọi API `PUT` để lưu.