# Chuyển dữ liệu localhost sang VPS

Bộ dữ liệu chuẩn bị ngày 12/10/2026 lấy từ `backend-postgres-1`, database `api`: 22 tài khoản, 11.042 từ vựng, 49 bộ luyện tập, 3 đề thi, 8 bản ghi lịch sử và 6 file upload. Nguồn gốc vẫn nằm trong volume `backend_boilerplate-db`; không chạy migration trực tiếp lên nguồn này.

Archive riêng: `transfers/tricehsk-local-data.tar.gz`. Archive mã nguồn `tricehsk-deploy.tar.gz` không chứa dữ liệu. Archive dữ liệu có database dump, uploads, manifest kiểm tra SHA-256/số bản ghi và các script nhập. Không chia sẻ archive dữ liệu công khai.

Dump đã được khôi phục và chuẩn hóa trên PostgreSQL tạm: lịch sử migration localhost chỉ có 6 bản ghi nhưng một số cột và bảng audit đã được tạo thủ công. `run-import-migrations.cjs` xử lý trường hợp này trên database `tricehsk_import_*`: giữ cột đúng kiểu, thêm cột/index thiếu, kiểm tra nullable và thực hiện migration trong transaction. Không dùng synchronize hoặc xóa cột/bảng. Kiểu cột không tương thích hay NULL trong cột bắt buộc sẽ dừng bước chuẩn bị. Bản đã chuẩn hóa có đủ các cột entity của API và giữ nguyên số bản ghi. Dump gốc được giữ riêng trong thư mục transfer local.

Trên PowerShell Windows:

```powershell
scp "D:\trice_hsk\deploy\transfers\tricehsk-local-data.tar.gz" user@100.104.108.58:/home/user/tricehsk-local-data.tar.gz
```

Trên VPS:

```bash
cd ~/trice_hsk/deploy
mkdir -p -m 700 transfers/local-data-import
chmod 700 transfers/local-data-import
tar -xzf ~/tricehsk-local-data.tar.gz -C transfers/local-data-import
bash transfers/local-data-import/import-local-data.sh
```

Nếu đã dùng Cloudflare Tunnel, thêm `--tunnel` cuối lệnh Bash. Cần API hiện tại đang chạy và đủ dung lượng cho backup/database/upload volume mới. Bước chuẩn bị xác minh checksum, backup VPS, khôi phục vào database mới và chạy migration/kiểm tra số bản ghi. `pg_restore --single-transaction --no-owner --no-acl` khôi phục nguyên schema/data mà không yêu cầu role của máy localhost; xem [tài liệu PostgreSQL](https://www.postgresql.org/docs/17/app-pgrestore.html).

Script giữ 22 tài khoản localhost và các liên kết theo ID. Đúng một admin email đang hoạt động trong bản nhập được đổi sang email/mật khẩu `SEED_ADMIN_*` hiện tại của VPS; tài khoản khác giữ nguyên mật khẩu. Nếu email mới trùng tài khoản khác hoặc nguồn có nhiều admin, script dừng trước khi chuyển database. Phiên cũ bị thu hồi. Đường dẫn `/api/v1/files\...` từ Windows được chuẩn hóa sang dấu `/` và đối chiếu file trong archive.

File upload được nhập vào volume mới. Khi chuẩn bị xong, script tạm dừng API, cập nhật `DATABASE_NAME`, bỏ `DATABASE_URL` cũ, đặt `UPLOADS_VOLUME_NAME` trong `.env` và thêm tên volume cấu hình được vào `compose.yaml`. PostgreSQL/API/Web được tạo lại để sử dụng đúng database và cập nhật địa chỉ container. Có gián đoạn ngắn lúc chuyển. Database/volume trước đó vẫn được giữ. Nếu chuyển lỗi, script thử khôi phục `.env`/Compose và khởi động lại bộ cũ; nếu rollback lỗi, giữ tất cả backup và kiểm tra log.

Thành công phải có `LOCAL_DATA_IMPORTED`. Đăng nhập lại bằng thông tin admin VPS hiện tại, kiểm tra học viên/từ vựng/bộ luyện tập/đề thi và ảnh. Backup sau này dùng tên database mới; cập nhật code bằng gói mã nguồn sẽ giữ `UPLOADS_VOLUME_NAME`. Đừng xóa database/volume cũ trước khi kiểm tra hoàn tất.

Nếu đã có `IMPORT_DATABASE_OK` nhưng chuyển thất bại rồi rollback, database và volume đã nhập vẫn được giữ. Bản script mới chờ web sẵn sàng, thử lại cả lỗi reset kết nối trong health check có giới hạn thời gian. Có thể dùng lại bản đã nhập bằng `bash transfers/local-data-import/import-local-data.sh --tunnel --resume YYYYMMDD_HHMMSS`, lấy timestamp chính xác từ tên database/volume trong log. Resume kiểm tra volume tồn tại, checksum, số bản ghi và file trước khi chuyển, không restore hoặc tạo thêm database/volume. Khi CI/CD đã kích hoạt, script chặn chuyển bằng Compose cũ để tránh bỏ overlay image đang chạy.

`export-local-data.ps1` xuất một dump gốc và uploads để chuẩn bị đợt chuyển khác. Dump gốc chưa được đánh dấu chuẩn hóa nên script nhập sẽ từ chối cho đến khi khôi phục/chuẩn hóa/kiểm tra và đóng gói lại. Không áp dụng archive đã có manifest của đợt cũ cho dump mới.

Kiểm chứng local: PostgreSQL 17 thật khôi phục cả dump gốc và bản chuẩn hóa, chạy migration/lặp lại migration, so số bản ghi, kiểm tra tất cả cột entity, giữ admin/thu hồi phiên và kiểm tra chuẩn hóa đường dẫn file. Script Bash qua kiểm tra cú pháp; chưa chạy bước chuyển database/volume trên VPS từ agent.
