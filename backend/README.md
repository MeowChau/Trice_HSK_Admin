# 🇨🇳 TriceHSK Backend API Server (NestJS 11 + PostgreSQL)

Hệ thống API RESTful cung cấp toàn bộ nghiệp vụ học tập, ngân hàng câu hỏi, luyện kỹ năng và thi thử HSK 1 - 9 cho TriceHSK.

> 📖 **Xem hướng dẫn tổng thể dự án và tài liệu kết nối API cho Frontend tại:**
> 👉 **[Tài liệu chi tiết tại Root README.md](../README.md)**

---

## 🚀 Khởi chạy nhanh (Quick Start)

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Cấu hình biến môi trường:
```bash
# Windows PowerShell:
Copy-Item .env.example .env

# macOS / Linux / Git Bash:
cp .env.example .env
```

### 3. Chạy Database PostgreSQL bằng Docker:
```bash
docker compose up -d postgres redis
```

### 4. Khởi động server (Watch mode):
```bash
npm run start:dev
```

- **API Endpoint:** `http://localhost:3001/api/v1`
- **Swagger Documentation:** `http://localhost:3001/docs`

---

## 🛠️ Các lệnh thường dùng

- `npm run start:dev`: Chạy backend trong môi trường phát triển (tự động reload khi sửa code)
- `npm run build`: Build dự án sang thư mục `dist/`
- `npm run start:prod`: Chạy production bundle
- `npm run lint`: Kiểm tra ESLint (sửa tự động bằng `npm run lint -- --fix`)
- `npm run typecheck`: Kiểm tra kiểu dữ liệu ứng dụng và script tạo admin
- `npm test -- --runInBand`: Chạy test hồi quy, không cần kết nối database/Redis
- `npm run check`: Chạy lint, typecheck, test và build
- `npm run test:integration`: Kiểm tra migration, transaction và ghi đồng thời trên PostgreSQL thật; cần `TEST_DATABASE_URL` của tài khoản test có quyền `CREATEDB`
- `docker compose up -d`: Khởi chạy toàn bộ dịch vụ phụ trợ (Postgres, Redis, Maildev)
- `docker compose down`: Tắt các container phụ trợ

---

## 📑 Tài liệu API (Swagger UI)
Truy cập **[http://localhost:3001/docs](http://localhost:3001/docs)** khi server đang chạy để xem chi tiết mọi endpoint, request/response body và thử nghiệm gọi API trực tiếp.

## Chất lượng code và thay đổi API

Dùng Node theo `.nvmrc`, cài dependency bằng `npm ci`, rồi chạy `npm run check`. GitHub Actions tại root repository chạy cùng bộ kiểm tra khi backend thay đổi.

CI chạy thêm bộ PostgreSQL integration trên database tạm riêng. Suite chỉ tạo/xóa database `backend_review_<uuid>`. Hai migration mới bổ sung trạng thái xác nhận email, unique index mã học viên, bảng audit log và các cột nội dung còn thiếu. Chạy `npm run migration:run` khi cập nhật database; kiểm tra mã học viên trùng và schema đã tạo thủ công trước khi áp dụng.

Xác nhận email ghi `emailVerifiedAt`; đăng nhập email/social và refresh yêu cầu tài khoản active. `POST /api/v1/auth/email/resend` gửi lại link xác nhận. `AUTH_RATE_LIMIT` mặc định giới hạn 10 yêu cầu/IP/endpoint/phút cho các API auth nhạy cảm.

API ghi câu hỏi, bài luyện tập, đề thi và từ vựng yêu cầu admin hoặc giảng viên đang hoạt động. Audit log chỉ dành cho admin. Các API thống kê quản trị yêu cầu admin/giảng viên. API đọc nội dung học tập giữ nguyên quyền truy cập hiện có.

Request body/query được kiểm tra bằng DTO; dữ liệu sai trả 422 và ID không phải số ở API nội dung trả 400. Mục tiêu học tập được lưu khi tạo/cập nhật tài khoản. JWT được đối chiếu với phiên và tài khoản hiện tại, nên đăng xuất, khóa tài khoản và đổi quyền có hiệu lực ở request tiếp theo.

Seed yêu cầu `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` được cấu hình riêng trong mọi môi trường (production yêu cầu mật khẩu ít nhất 12 ký tự). Không có tài khoản admin mặc định. Script `create-admin.ts` cũng yêu cầu hai biến này. Tài khoản không truyền mật khẩu không dùng mật khẩu chung; hãy truyền mật khẩu khi tạo hoặc dùng API cấp mật khẩu tạm thời. E2E test lấy thông tin qua biến môi trường; không đưa giá trị tài khoản vào mã nguồn hoặc file cấu hình mẫu.

Chấm bài viết cần `GEMINI_API_KEY`; model có thể đổi bằng `GEMINI_MODEL`. Thiếu cấu hình trả 503. Chấm phát âm trả 503 cho đến khi tích hợp speech provider. Chi tiết phạm vi rà soát, các kiểm tra đã chạy và phần chưa hoàn thiện nằm trong [báo cáo backend](docs/backend-review.md).
