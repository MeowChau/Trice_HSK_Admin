# CI/CD cho TriceHSK

Repository mặc định: `MeowChau/Trice_HSK_Admin`. VPS hiện dùng Tailscale và Docker Compose. GitHub Actions kiểm tra/build trên runner GitHub; VPS tự lấy image qua GHCR trên HTTPS. Không cần GitHub SSH vào VPS, mở port public, thêm runner vào tailnet hay chạy mã của pull request trên VPS.

## Cách hoạt động

1. Pull request vào `main`: lint/typecheck/unit test/build backend, PostgreSQL integration test, build/typecheck dashboard và kiểm tra công cụ triển khai. Frontend chưa áp dụng lint toàn repository vì template hiện còn lỗi lint có sẵn; bước build vẫn kiểm tra TypeScript.
2. Push vào `main` hoặc Run workflow trên `main`: khi mọi kiểm tra đạt, build và xuất bản API/admin `linux/amd64`. Image gắn commit SHA và nhãn revision; các Action được ghim commit SHA. Dependabot đề xuất cập nhật Actions qua PR.
3. Cuối cùng mới xuất bản image nhỏ `*-release:production` chứa manifest với **hai digest bất biến** và năm file Compose/Nginx. Nếu build một ứng dụng lỗi, release cũ giữ nguyên. Manifest/bundle không chứa `.env`, token hay database. [GHCR và image digest](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
4. Systemd trên VPS kiểm tra khoảng mỗi hai phút sau khi pipeline xuất bản (không phải hai phút kể từ push). Nó kiểm tra manifest, revision của cả hai image, tên project, database đang dùng, volume upload, cú pháp Nginx và migration đang chờ.
5. Nếu không có migration mới: tạm dừng API/admin/web, sao lưu database/uploads/cấu hình, cập nhật image và file cấu hình, chờ container healthy rồi kiểm tra `/health` và form `/signin`. Nếu lỗi, phục hồi image/cấu hình trước. Phiên bản lỗi không được thử triển khai lặp lại đến khi có release khác hoặc operator yêu cầu retry.

Có gián đoạn khi backup/thay container; không phải triển khai không downtime. Database/Redis/Maildev/cloudflared không được tạo lại trong lần cập nhật ứng dụng. Nginx dùng image hiện đang chạy, chỉ thay cấu hình. Token Cloudflare, mật khẩu/JWT và tên database/upload volume trong `.env` được giữ.

## 1. Đưa workflow và code hiện tại lên GitHub

Các file cần có trong commit: `.github/workflows/ci-cd.yml`, `.github/workflows/backend-quality.yml`, `.github/dependabot.yml`, bộ `deploy/ci`, `deploy/compose.release.yaml` và code ứng dụng đã kiểm tra. Backend hiện có nhiều thay đổi chưa commit (quality script, test, migration, auth); phải review và commit các thay đổi đó cùng đợt triển khai đầu tiên. Không chỉ đẩy workflow trong khi package/backend trên GitHub vẫn là bản cũ.

Trong GitHub → Actions, workflow có tên **CI and production images**. Pull request chỉ kiểm tra, không xuất bản. Trong job `publish`, token mặc định `GITHUB_TOKEN` được cấp `packages: write`; không cần tạo secret SSH/password/Tailscale. Các job kiểm tra chỉ có `contents: read`, checkout không lưu credentials. Nên bảo vệ `main`, yêu cầu các job backend/dashboard/deployment-tools đạt và review PR trước khi merge để kiểm soát release production.

GitHub Actions dùng quota theo gói GitHub của repository. Build chạy trên runner GitHub, không dùng CPU/RAM của VPS.

## 2. Tạo token chỉ để tải image trên VPS

GitHub → Settings tài khoản → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic).

- Đặt tên dễ nhận biết, ví dụ `tricehsk-vps-pull`.
- Chỉ chọn scope **`read:packages`**. Dùng tài khoản có quyền đọc package của repo; nếu organization dùng SSO thì token cũng cần được cấp quyền SSO.
- Chọn hạn sử dụng phù hợp và theo dõi ngày hết hạn. Không cấp `write:packages`, `delete:packages` hay quyền SSH cho VPS.
- Giữ token riêng để dán vào prompt trên VPS, không gửi lên chat hoặc commit. [Xác thực GHCR bằng PAT classic](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-with-a-personal-access-token-classic).

Package mặc định private. PAT dùng bởi Docker root trên VPS (installer nhận qua stdin), không nằm trong `.env` của ứng dụng, không được đưa vào GitHub Actions. Nếu chưa có release image vì workflow chưa chạy thành công, timer sẽ chờ/lần kiểm tra báo không tải được; ứng dụng hiện tại vẫn hoạt động.

## 3. Cài một lần trên VPS

Gói `D:\trice_hsk\tricehsk-cicd-setup.tar.gz` chỉ có công cụ CI/CD và tài liệu, không có dữ liệu hay secret. Có thể tạo lại gói bằng `powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/package-cicd.ps1` tại thư mục dự án. PowerShell **Windows**:

```powershell
scp "D:\trice_hsk\tricehsk-cicd-setup.tar.gz" user@100.104.108.58:/home/user/
```

Terminal **VPS**:

```bash
cd ~/trice_hsk/deploy
tar -xzf ~/tricehsk-cicd-setup.tar.gz -C .
sudo bash ci/install.sh
```

Giữ Docker/Compose và stack hiện tại đang chạy. Installer cài Python 3 nếu thiếu, đăng nhập GHCR, ghi cấu hình `/etc/tricehsk-cd.json`, cài hai wrapper và systemd timer. Tên repo/user mặc định phù hợp remote hiện tại; Enter để giữ. Khi prompt token hiện ra, dán token rồi Enter; ký tự được ẩn. Có `cloudflare.env`/Compose tunnel thì installer sử dụng tunnel deployment hiện tại. Nếu bạn chuyển repo/mode triển khai, sửa cấu hình JSON tương ứng hoặc chạy lại installer.

Khi có `CI_CD_INSTALLED`, kiểm tra:

```bash
sudo systemctl status tricehsk-cd.timer --no-pager
sudo journalctl -u tricehsk-cd.service -n 50 --no-pager
sudo tricehsk-deploy --status
sudo tricehsk-compose ps
```

Thành công thực sự phải có `DEPLOYMENT_OK` với commit SHA tương ứng bản đã đạt CI, container API/admin healthy và web/đăng nhập hoạt động. Installer chạy xong chưa xác nhận deployment thành công. Chưa chạy GitHub workflow hoặc cài updater lên VPS từ agent trong phiên chuẩn bị này.

## 4. Các lần cập nhật sau

Sửa code → kiểm tra → commit/push hoặc merge PR vào `main`. CI xuất bản xong, timer lấy bản mới. VPS không cần build hoặc upload archive mã nguồn mỗi lần nữa.

Để triển khai ngay khi đã có release:

```bash
sudo tricehsk-deploy
```

Sau khi cài CI/CD, dùng wrapper thay cho lệnh Compose cũ để giữ đúng image của phiên bản đang chạy:

```bash
sudo tricehsk-compose ps
sudo tricehsk-compose logs --tail=50 api web
```

Không dùng lệnh `compose build/up api` cũ để cập nhật trong lúc timer quản lý production. Thay đổi script updater/installer cần cài lại gói công cụ; cấu hình Compose/Nginx trong release được cập nhật tự động. Thay đổi infrastructure như subnet, loại database hoặc image Nginx/cloudflared cần quy trình riêng.

## 5. Khi có migration database

Timer ghi `pending.json` và giữ nguyên phiên bản hiện tại. Sau khi review migration, kiểm tra nó trên bản sao dữ liệu và chọn thời điểm bảo trì, operator triển khai:

```bash
sudo tricehsk-deploy --allow-migrations
```

Database/uploads được sao lưu sau khi API/admin/web đã dừng ghi, trước migration. Nếu migration được thử chạy rồi triển khai lỗi, updater giữ ứng dụng dừng và yêu cầu phục hồi chủ động. Không tự chạy migration:revert hoặc hạ code lên schema có thể đã thay đổi. Backup nằm trong `<deploy>/.ci/backups/`; cần bản sao ngoài VPS và thử phục hồi trước khi dùng cho sự cố thật.

## 6. Khi cần xử lý sự cố

```bash
sudo journalctl -u tricehsk-cd.service -n 80 --no-pager
sudo tricehsk-deploy --status
```

Nếu bản không có migration bị lỗi khởi động/health, updater thử phục hồi cấu hình/image trước đó. Sau khi sửa nguyên nhân trên máy chủ, operator có thể yêu cầu thử lại đúng release bị đánh dấu lỗi:

```bash
sudo tricehsk-deploy --retry-failed
```

Tạm dừng tự cập nhật bằng `sudo systemctl stop tricehsk-cd.timer`; không dừng container ứng dụng đang chạy. Khóa file trong `.ci` tránh hai lần triển khai cùng lúc. Docker/private backup/state dùng dung lượng VPS: updater hoãn khi Docker còn dưới 2 GiB, không tự prune image/volume hay xóa backup. Theo dõi dung lượng và dọn các bản đã xác nhận không cần bằng quy trình riêng.

Kiểm chứng: 15 unit test mô phỏng Docker bao phủ manifest/namespace/digest, cặp revision, database/volume, migration cần duyệt, backup failure, rollback image/cấu hình, dừng sau migration lỗi, không lặp lại release lỗi, nội dung health check và không đóng gói secret. Actionlint và ShellCheck đã đạt. Compose thực tế đã xác nhận overlay image, database/volume đã nhập và đường dẫn Nginx; image metadata đã được build, tạo container không chạy, trích xuất rồi kiểm tra manifest. End-to-end GitHub → GHCR → VPS cần xác nhận khi kích hoạt bằng tài khoản thật.
