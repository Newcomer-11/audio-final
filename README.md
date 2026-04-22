# 🎵 Audio Site

Website nghe nhạc đơn giản với trang admin upload file.

## Cấu trúc

```
audio-site/
├── server.js          # Backend Node.js (Express)
├── package.json
├── Procfile           # Cho Render/Railway
├── public/
│   ├── index.html     # Trang người dùng nghe nhạc
│   ├── login.html     # Trang đăng nhập admin
│   ├── admin.html     # Trang admin upload
│   └── audio/         # Thư mục chứa file nhạc (tự tạo)
└── .env.example
```

## Chạy local

```bash
npm install
node server.js
# Mở http://localhost:3000
# Admin: http://localhost:3000/admin (mật khẩu mặc định: admin123)
```

## Deploy lên Render (FREE, khuyên dùng)

Xem hướng dẫn chi tiết ở phần dưới README.
