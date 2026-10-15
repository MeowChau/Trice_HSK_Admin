# Sửa đăng nhập thành công nhưng vẫn ở `/signin`

Chrome trên bản production cũ tái hiện được: POST đăng nhập trả thành công, token và cookie đã lưu, nhưng `router.push("/")` không tạo yêu cầu điều hướng mới và URL vẫn ở `/signin`. Reload mới vào dashboard.

Link logo trong layout auth tự tải trước `/` khi chưa có cookie. Proxy chuyển yêu cầu đó về `/signin`, và Next lưu kết quả trong Router Cache. Lần chuyển trang sau khi cookie thay đổi vẫn dùng kết quả chưa đăng nhập.

Thay đổi:

- Dùng `window.location.replace("/")` sau khi lưu phiên để gửi yêu cầu document mới với cookie mới; trang đăng nhập không còn nằm trong lịch sử Back.
- Tắt prefetch của link logo tới dashboard trên màn hình auth.
- Giới hạn cả fetch và đọc JSON đăng nhập ở 20 giây; trả thông báo khi máy chủ hoặc mạng không phản hồi, bỏ trạng thái chờ trong form.
- Xác nhận cookie thực sự được lưu. Cookie bị chặn sẽ có thông báo và xóa phần phiên lưu dở.
- Đặt tên, id và autocomplete cho hai trường; đọc FormData khi submit để sử dụng giá trị trình quản lý mật khẩu thực sự đã điền.

Tài khoản không cố định trong code đăng nhập: `AuthService.validateLogin` gọi `UsersService.findByLogin` rồi `bcrypt.compare` với hash trong database. `SEED_ADMIN_EMAIL/PASSWORD` dùng cho seed tạo admin đầu tiên hoặc công cụ khôi phục được chạy riêng; đổi biến môi trường không tự sửa tài khoản đang tồn tại. Mọi môi trường đều yêu cầu cấu hình riêng, không có tài khoản admin mẫu. Form đăng nhập khởi tạo email và mật khẩu rỗng.

Kiểm chứng: lint, typecheck, build production 39 trang; 29 test giao diện (8 test đăng nhập mới); Chrome thực tế qua 5 tình huống: đăng nhập bình thường, còn Router Cache cũ, autofill không cập nhật React state, sai mật khẩu và cookie bị chặn. Browser test mock phản hồi API và dùng tài khoản giả; không gửi hoặc lưu mật khẩu thật, không tạo tài khoản/session trong database VPS.

Triển khai bằng gói nguồn và `deploy/deploy-windows.ps1` đã có kiểm tra checksum, cấu hình/database/upload và khôi phục khi lỗi. Không chạy seed, reset admin hoặc migration trong bản sửa này. Trạng thái mỗi lần chạy nằm trong `deploy/transfers/source-update-status.json`.
