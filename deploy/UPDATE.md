# Cập nhật mã nguồn đã refactor lên VPS

Trong PowerShell **Windows**, chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\trice_hsk\deploy\deploy-windows.ps1
```

Nhập mật khẩu VPS khi `scp`, `ssh` và `sudo` hỏi. Mật khẩu không hiện ký tự khi gõ. Giữ cửa sổ mở tới dòng `SOURCE_UPDATE_OK`. Sau đó mở `https://admin.tricehsk.id.vn` và nhấn Ctrl+F5.

Script upload `tricehsk-deploy.tar.gz`, đối chiếu SHA256, tự nhận cấu hình Cloudflare hiện có, build API rồi admin bằng image riêng trong khi bản cũ chạy. Nó kiểm tra các cột database mà bản mới cần trước khi chuyển container. Nếu thiếu cột thì dừng, giữ bản đang chạy; không tự chạy migration hoặc seed.

Trước lúc chuyển, API dừng ngắn để sao lưu đúng database đang dùng và thư mục upload. Backup gồm database, uploads, cấu hình, nguồn cũ và image cũ trong `deploy/backups/source-update-*`, quyền riêng. Tài khoản, câu hỏi, đề thi, từ vựng và file upload dùng tiếp dữ liệu hiện tại. Các bộ Compose, nginx, `.env`, Cloudflare token, database và upload volume hiện tại được giữ. Script kiểm tra lại số dòng của sáu bảng nội dung sau cập nhật.

Các thư mục nguồn được thay nguyên bộ sau khi image mới hoạt động, nên component đã xóa không còn sót qua việc giải nén đè. Lỗi trước khi chuyển giữ các container cũ; lỗi khi chuyển sẽ thử khôi phục image và nguồn cũ, báo rõ nếu không xác nhận được khôi phục. Không khôi phục database tự động vì thao tác này không sửa dữ liệu.

Nếu CI/CD đã quản lý image (`deploy/.ci/active-images.env`), script dừng để cập nhật theo workflow hiện có. Không tắt CI/CD để lách kiểm tra này.

Nếu cần chạy bằng tay, upload hai file trong Windows:

```powershell
scp D:\trice_hsk\tricehsk-deploy.tar.gz D:\trice_hsk\deploy\update-source.sh user@100.104.108.58:/home/user/
(Get-FileHash D:\trice_hsk\tricehsk-deploy.tar.gz -Algorithm SHA256).Hash.ToLowerInvariant()
ssh user@100.104.108.58
```

Sau đó trong **VPS**, thay `SHA256_TREN_WINDOWS` bằng dòng hash trên:

```bash
bash /home/user/update-source.sh --archive /home/user/tricehsk-deploy.tar.gz --sha256 SHA256_TREN_WINDOWS --project /home/user/trice_hsk
```

Xem dấu phiên bản sau thành công: `cat /home/user/trice_hsk/deploy/.source-update-version`. Kết quả từng lần chạy trên Windows nằm trong `deploy/transfers/source-update-status.json`; chỉ trạng thái `complete` xác nhận lệnh VPS đã hoàn tất. Mất kết nối SSH giữa chừng cần kiểm tra VPS và phiên bản trước khi chạy lại.
