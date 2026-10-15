# 🇨🇳 TriceHSK - Nền tảng Học & Luyện thi HSK Toàn diện (HSK 1 - 9)

> Hướng dẫn thiết lập hệ thống, khởi chạy môi trường phát triển (Local Development) và tài liệu tích hợp API dành cho đội ngũ phát triển Frontend.

> **Trạng thái API:** Các mục `grammar`, `exam-submissions`, `flashcards` và endpoint dưới `gamification` trong bảng bên dưới là tính năng dự kiến, chưa có controller trong backend hiện tại. Bảng xếp hạng đã triển khai ở `/api/v1/leaderboard/streak`. Dùng Swagger của server và [báo cáo rà soát backend](backend/docs/backend-review.md) để đối chiếu API thực tế.

---

## 📑 Mục lục
1. [Kiến trúc hệ thống](#1-kiến-trúc-hệ-thống)
2. [Yêu cầu môi trường (Prerequisites)](#2-yêu-cầu-môi-trường-prerequisites)
3. [Hướng dẫn cài đặt & Chạy sau khi Clone](#3-hướng-dẫn-cài-đặt--chạy-sau-khi-clone)
   - [Bước 1: Clone mã nguồn](#bước-1-clone-mã-nguồn)
   - [Bước 2: Cấu hình cơ sở dữ liệu (PostgreSQL)](#bước-2-cấu-hình-cơ-sở-dữ-liệu-postgresql)
   - [Bước 3: Khởi chạy Backend API (NestJS)](#bước-3-khởi-chạy-backend-api-nestjs)
   - [Bước 4: (Tùy chọn) Khởi chạy Admin Dashboard](#bước-4-tùy-chọn-khởi-chạy-admin-dashboard)
4. [Hướng dẫn xem và sử dụng API Documentation (Swagger)](#4-hướng-dẫn-xem-và-sử-dụng-api-documentation-swagger)
5. [Tài liệu API cốt lõi dành cho Frontend Dev (Cheat Sheet)](#5-tài-liệu-api-cốt-lõi-dành-cho-frontend-dev-cheat-sheet)
   - [1. Xác thực & Tài khoản (Auth & User)](#1-xác-thực--tài-khoản-auth--user)
   - [2. Kho Từ vựng HSK 1 - 9 (Vocabulary)](#2-kho-từ-vựng-hsk-1---9-vocabulary)
   - [3. Ngữ pháp HSK (Grammar)](#3-ngữ-pháp-hsk-grammar)
   - [4. Luyện kỹ năng Nghe/Nói/Đọc/Viết (Practice Sets)](#4-luyện-kỹ-năng-nghenóiđọcviết-practice-sets)
   - [5. Ngân hàng câu hỏi & Bài tập (Questions)](#5-ngân-hàng-câu-hỏi--bài-tập-questions)
   - [6. Đề thi thử HSK mô phỏng (Mock Exams)](#6-đề-thi-thử-hsk-mô-phỏng-mock-exams)
   - [7. Gamification & Streak (Học tập tương tác)](#7-gamification--streak-học-tập-tương-tác)
   - [8. Tải tệp Audio / Hình ảnh (File Upload)](#8-tải-tệp-audio--hình-ảnh-file-upload)
6. [Mã mẫu kết nối API từ Frontend (Axios / Fetch)](#6-mã-mẫu-kết-nối-api-từ-frontend-axios--fetch)
7. [Các lỗi thường gặp và cách xử lý (Troubleshooting)](#7-các-lỗi-thường-gặp-và-cách-xử-lý-troubleshooting)

---

## 1. Kiến trúc hệ thống

```
backend_hsk/
├── backend/             # RESTful API Server (NestJS 11 + TypeORM + PostgreSQL)
│   ├── src/             # Mã nguồn API (Auth, Vocabulary, Questions, Practice Sets, Exams,...)
│   ├── docker-compose.yaml # Docker chạy Postgres, Redis, Maildev
│   └── .env.example     # File mẫu biến môi trường backend
├── fe_admin/            # Giao diện Web Quản trị Admin (Next.js 15 + Tailwind CSS)
│   └── dashboard/       # Quản lý đề thi, câu hỏi, bài học, từ vựng, học viên
└── fe_user/             # (Dự án Frontend người dùng / App học viên bạn sắp phát triển)
```

- **Backend API**: `http://localhost:3001/api/v1`
- **Swagger API Docs**: `http://localhost:3001/docs`
- **Frontend Admin Panel**: `http://localhost:3000`

---

## 2. Yêu cầu môi trường (Prerequisites)

Trước khi bắt đầu, máy tính lập trình viên cần cài đặt:
- **Node.js**: Phiên bản `>= 18.x` (Khuyến nghị `v20.x LTS` hoặc `v22.x`). Kiểm tra bằng `node -v`.
- **NPM** hoặc **Yarn** / **PNPM**.
- **PostgreSQL**: Phiên bản `>= 14` (Cài trực tiếp hoặc thông qua Docker).
- **Docker & Docker Compose** (Tùy chọn, khuyến nghị nếu muốn chạy Postgres nhanh không cần cài thủ công).

---

## 3. Hướng dẫn cài đặt & Chạy sau khi Clone

### Bước 1: Clone mã nguồn
```bash
git clone <URL_REPO_CUA_BAN>
cd backend_hsk
```

---

### Bước 2: Cấu hình cơ sở dữ liệu (PostgreSQL)

Chọn **1 trong 2 cách** sau:

#### Cách A: Dùng Docker (Nhanh nhất & Khuyên dùng)
Tại thư mục `backend/`, chạy lệnh khởi động database PostgreSQL và Redis:
```bash
cd backend
docker compose up -d postgres redis
```
Lệnh này sẽ tạo container PostgreSQL chạy tại port `5432` với user `root`, mật khẩu `secret`, database `api`.

#### Cách B: Dùng PostgreSQL cài sẵn trên máy (Local Postgres)
Tạo một cơ sở dữ liệu mới trong PostgreSQL:
- **Host**: `localhost`
- **Port**: `5432`
- **User**: `root` (hoặc `postgres`)
- **Password**: `secret` (hoặc mật khẩu của bạn)
- **Database Name**: `api`

---

### Bước 3: Khởi chạy Backend API (NestJS)

1. **Di chuyển vào thư mục backend**:
   ```bash
   cd backend
   ```

2. **Cài đặt thư viện dependencies**:
   ```bash
   npm install
   ```

3. **Tạo file cấu hình `.env`**:
   Copy từ file `.env.example`:
   ```bash
   # Trên Windows PowerShell:
   Copy-Item .env.example .env

   # Trên Linux / macOS / Git Bash:
   cp .env.example .env
   ```

   > 💡 **Lưu ý cấu hình quan trọng trong `backend/.env`**:
   > - `APP_PORT=3001`: Cổng chạy API Backend.
   > - `DATABASE_HOST=localhost`, `DATABASE_PORT=5432`, `DATABASE_NAME=api`, `DATABASE_USERNAME=root`, `DATABASE_PASSWORD=secret`.
   > - `APP_CORS_ORIGINS`: Đã cấu hình sẵn cho các cổng `3000`, `3001`, `3002`, `5173` (Vite) và `*`.

4. **Khởi động server Backend ở chế độ phát triển (Watch mode)**:
   ```bash
   npm run start:dev
   ```

   Khi terminal hiển thị:
   ```
   [Nest] LOG [NestApplication] Nest application successfully started
   ```
   Backend đã sẵn sàng hoạt động tại: **`http://localhost:3001`**!

---

### Bước 4: (Tùy chọn) Khởi chạy Admin Dashboard

Nếu bạn cần đăng nhập trang quản trị để xem cấu trúc đề thi, tạo dữ liệu mẫu hoặc kiểm tra tính năng:

```bash
cd ../fe_admin/dashboard
npm install
npm run dev
```
Truy cập: **`http://localhost:3000`**

---

## 4. Hướng dẫn xem và sử dụng API Documentation (Swagger)

Backend đã tích hợp đầy đủ tài liệu API tương tác bằng OpenAPI / Swagger:

### 1. Truy cập Swagger UI
Mở trình duyệt và vào đường dẫn:
👉 **[http://localhost:3001/docs](http://localhost:3001/docs)**

![Swagger UI](https://raw.githubusercontent.com/swagger-api/swagger-ui/master/flavor/swagger_ui.png)

### 2. Giao diện Swagger cung cấp những gì?
- Danh sách tất cả các module nghiệp vụ được phân nhóm rõ ràng (Auth, Users, Vocabulary, Grammar, Practice Sets, Questions, Exams, Gamification,...).
- Chi tiết phương thức HTTP (`GET`, `POST`, `PATCH`, `DELETE`, `PUT`).
- Mô tả kiểu dữ liệu Request Body, Query Parameters và cấu trúc Response JSON chuẩn.
- Tính năng **"Try it out"** giúp bạn gửi request và xem kết quả thực tế trực tiếp từ trình duyệt.

### 3. Cách lấy Token và phân quyền trên Swagger:
Hầu hết các API cần người dùng đăng nhập đều yêu cầu `Bearer Token`:
1. Trên Swagger, tìm đến nhóm **Auth** -> chọn `POST /api/v1/auth/email/login`.
2. Bấm **Try it out** và đăng nhập với tài khoản đã được tạo bằng cấu hình riêng trong `.env` (hoặc dùng `POST /api/v1/auth/email/register` để tạo tài khoản học viên mới). Không có tài khoản admin mặc định; không commit thông tin đăng nhập lên Git.
3. Copy chuỗi `token` trong kết quả trả về:
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsIn...",
     "refreshToken": "...",
     "tokenExpires": 1728100000000,
     "user": { "id": 1, "email": "student@example.com", ... }
   }
   ```
4. Cuộn lên đầu trang Swagger, bấm nút **Authorize (hình ổ khóa xanh)** ở góc trên bên phải.
5. Dán chuỗi token vừa copy vào ô **Value** và bấm **Authorize**.
6. Giờ đây bạn có thể gọi mọi API yêu cầu đăng nhập trên Swagger một cách dễ dàng!

---

## 5. Tài liệu API cốt lõi dành cho Frontend Dev (Cheat Sheet)

Tất cả các endpoint đều có tiền tố: **`http://localhost:3001/api/v1`**

### 1. Xác thực & Tài khoản (Auth & User)
| Method | Endpoint | Mô tả | Header |
|---|---|---|---|
| `POST` | `/api/v1/auth/email/register` | Đăng ký tài khoản học viên mới | Public |
| `POST` | `/api/v1/auth/email/login` | Đăng nhập (trả về Access Token & Refresh Token) | Public |
| `GET` | `/api/v1/auth/me` | Lấy thông tin tài khoản hiện tại | `Bearer <token>` |
| `PATCH` | `/api/v1/auth/me` | Cập nhật thông tin cá nhân (họ tên, avatar) | `Bearer <token>` |
| `POST` | `/api/v1/auth/refresh` | Cấp mới access token khi token cũ hết hạn | `Bearer <refreshToken>` |
| `POST` | `/api/v1/auth/logout` | Đăng xuất | `Bearer <token>` |

---

### 2. Kho Từ vựng HSK 1 - 9 (Vocabulary)
| Method | Endpoint | Query Params | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/vocabulary` | `page`, `limit`, `hskLevel`, `lesson`, `topic`, `search` | Danh sách từ vựng có phân trang và bộ lọc |
| `GET` | `/api/v1/vocabulary/:id` | - | Chi tiết từ vựng (chữ Hán, pinyin, nghĩa, ví dụ, audio phát âm) |
| `GET` | `/api/v1/vocabulary/topics` | `hskLevel` | Danh sách các chủ đề từ vựng theo cấp độ |

---

### 3. Ngữ pháp HSK (Grammar)
| Method | Endpoint | Query Params | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/grammar` | `page`, `limit`, `hskLevel`, `search` | Danh sách điểm ngữ pháp HSK, cấu trúc và câu mẫu |
| `GET` | `/api/v1/grammar/:id` | - | Chi tiết điểm ngữ pháp |

---

### 4. Luyện kỹ năng Nghe/Nói/Đọc/Viết (Practice Sets)
Mỗi bài học gom nhóm theo kỹ năng và cấp độ HSK:
| Method | Endpoint | Query Params | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/practice-sets` | `skill` (`LISTENING`/`SPEAKING`/`READING`/`WRITING`), `hskLevel`, `topic`, `page`, `limit` | Lấy danh sách bài luyện tập kỹ năng |
| `GET` | `/api/v1/practice-sets/:id` | - | Chi tiết bài học, bao gồm **file nghe (`audioUrl`)** và danh sách câu hỏi đính kèm |

---

### 5. Ngân hàng câu hỏi & Bài tập (Questions)
| Method | Endpoint | Query Params | Mô tả |
|---|---|---|---|
| `GET` | `/api/v1/questions` | `skill`, `hskLevel`, `type`, `page`, `limit` | Lấy danh sách câu hỏi |
| `GET` | `/api/v1/questions/:id` | - | Chi tiết câu hỏi: đề bài, audioUrl, transcript (lời thoại nghe), các lựa chọn A, B, C, D |

---

### 6. Đề thi thử HSK mô phỏng (Mock Exams)
Đề thi hoàn chỉnh mô phỏng kỳ thi thật (gồm các phần Nghe, Đọc, Viết có bấm giờ):
| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/v1/exams` | Danh sách đề thi thử theo cấp độ HSK (thời gian làm bài, điểm đạt) |
| `GET` | `/api/v1/exams/:id` | Toàn bộ cấu trúc đề thi, các phần thi (Sections) và file âm thanh phần Nghe |
| `POST` | `/api/v1/exam-submissions` | Nộp bài thi của học viên, hệ thống tự động chấm điểm và lưu kết quả |
| `GET` | `/api/v1/exam-submissions/:id` | Xem lại chi tiết bài làm, điểm số từng phần và giải thích đáp án |

---

### 7. Gamification & Streak (Học tập tương tác)
| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/v1/gamification/streak` | Lấy chuỗi ngày học tập liên tục (Streak) của học viên |
| `GET` | `/api/v1/gamification/leaderboard` | Bảng xếp hạng học viên có điểm cao nhất tuần/tháng |
| `GET` | `/api/v1/flashcards` | Bộ thẻ học từ vựng thông minh lặp lại ngắt quãng (Spaced Repetition) |

---

### 8. Tải tệp Audio / Hình ảnh (File Upload)
| Method | Endpoint | Content-Type | Body | Mô tả |
|---|---|---|---|---|
| `POST` | `/api/v1/files/upload` | `multipart/form-data` | `file: (Binary File)` | Upload tệp MP3, WAV, PNG, JPG (Tối đa 100MB) |

Trả về URL file:
```json
{
  "file": {
    "id": "...",
    "path": "/api/v1/files/e1a2b3c4.mp3"
  }
}
```
Để truy cập file: `http://localhost:3001/api/v1/files/e1a2b3c4.mp3`.

---

## 6. Mã mẫu kết nối API từ Frontend (Axios / Fetch)

### Cấu hình Axios Client chuẩn (kèm tự động gán Token)
```typescript
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động đính kèm Token vào Authorization Header
apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Xử lý lỗi 401 (Hết hạn phiên đăng nhập)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Có thể chuyển hướng về trang /login hoặc gọi api refresh token
      console.warn('Phiên đăng nhập đã hết hạn.');
    }
    return Promise.reject(error);
  }
);
```

### Ví dụ 1: Đăng nhập học viên
```typescript
export async function loginUser(email: string, password: string) {
  const res = await apiClient.post('/auth/email/login', { email, password });
  const { token, refreshToken, user } = res.data;
  localStorage.setItem('access_token', token);
  localStorage.setItem('refresh_token', refreshToken);
  return user;
}
```

### Ví dụ 2: Lấy danh sách từ vựng HSK 1
```typescript
export async function getHskVocabularies(level = 1, page = 1) {
  const res = await apiClient.get('/vocabulary', {
    params: {
      hskLevel: level,
      page,
      limit: 20,
    },
  });
  return res.data; // { data: [...], total: 150, page: 1, limit: 20 }
}
```

---

## 7. Các lỗi thường gặp và cách xử lý (Troubleshooting)

### 1. Lỗi CORS (Cross-Origin Request Blocked)
- **Hiện tượng**: Trình duyệt báo `Access to XMLHttpRequest at 'http://localhost:3001/...' blocked by CORS policy`.
- **Khắc phục**: Mở file `backend/.env`, kiểm tra dòng `APP_CORS_ORIGINS`. Hãy thêm origin của frontend bạn đang chạy (ví dụ `http://localhost:5173` hoặc `*`):
  ```env
  APP_CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:3002,*
  ```
  Sau đó khởi động lại backend (`Ctrl + C` và chạy lại `npm run start:dev`).

### 2. Lỗi kết nối cơ sở dữ liệu (Connection Refused 5432)
- **Hiện tượng**: `ECONNREFUSED 127.0.0.1:5432`.
- **Khắc phục**: 
  - Nếu dùng Docker: Đảm bảo container đang chạy: `docker compose ps` (hoặc chạy lại `docker compose up -d postgres`).
  - Nếu cài PostgreSQL cục bộ: Kiểm tra dịch vụ PostgreSQL Service trong Windows Services / macOS brew services đã ở trạng thái Running.

### 3. File Audio không phát được
- Hãy đảm bảo đường dẫn audio có domain của backend nếu là đường dẫn tương đối:
  ```typescript
  const fullAudioUrl = audioUrl.startsWith('http') 
    ? audioUrl 
    : `http://localhost:3001${audioUrl}`;
  ```

---

## 👥 Hỗ trợ & Đóng góp
Nếu gặp khó khăn trong quá trình tích hợp API hoặc cần bổ sung endpoint mới cho giao diện người dùng, vui lòng liên hệ team Backend hoặc mở Issue trên kho lưu trữ Git của dự án!
