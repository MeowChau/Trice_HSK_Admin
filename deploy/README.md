# TriceHSK trên Debian 12: từ nhận máy đến chạy thử và cập nhật

Thay ngân hàng câu hỏi từ sách HSK 1 và dùng form/audio mới: xem [HSK1_WORKBOOK.md](HSK1_WORKBOOK.md).

Hướng dẫn này dành cho VPS 1 vCPU / 3 GB RAM / 40 GB SSD, ban đầu truy cập riêng qua Tailscale và SSH. Không cần mua tên miền ngay. Các file đã được chuẩn bị trong repository, nhưng chưa có thao tác đăng nhập hoặc triển khai lên VPS của bạn.

## 1. Hiểu cách truy cập máy

IP được giao `100.104.108.58` là IP Tailscale, không phải IP public. Không trỏ bản ghi DNS công khai tới IP này. Địa chỉ này truy cập được khi máy bạn có Tailscale, đăng nhập đúng mạng/tài khoản và được cấp quyền tới VPS.

Link mời Tailscale không chứng minh máy đã chuyển quyền sở hữu vào tài khoản bạn: xem nội dung lời mời và hỏi bên bán bạn được mời vào mạng hay được chia sẻ máy. Không đăng xuất Tailscale trên VPS hoặc tự thay cấu hình mạng khi chưa hiểu quyền quản lý, vì có thể mất đường SSH.

- Cài [Tailscale cho Windows](https://tailscale.com/docs/install/windows).
- Mở lời mời bên bán gửi bằng trình duyệt, kiểm tra thông tin, chấp nhận bằng tài khoản bạn muốn sử dụng.
- Đăng nhập ứng dụng Tailscale trên Windows và bật kết nối. Nếu tham gia nhiều mạng, chọn mạng được mời.
- Mở PowerShell trên Windows:

```powershell
ssh user@100.104.108.58
```

Lần đầu SSH hỏi xác nhận khóa máy chủ. Nếu có fingerprint bên bán cung cấp, đối chiếu trước khi xác nhận. Nhập mật khẩu được giao; terminal không hiện ký tự khi gõ mật khẩu, đây là bình thường. Khi thấy dấu nhắc tương tự `user@BanChau9th10:~$`, các lệnh Linux phía dưới được chạy trên VPS.

## 2. Đổi mật khẩu và kiểm tra máy

Mật khẩu bàn giao đã xuất hiện trong cuộc trò chuyện; đổi mật khẩu trước khi sử dụng. Trong terminal VPS:

```bash
passwd
sudo passwd root
```

Lệnh đầu đổi mật khẩu của `user`, lệnh thứ hai đổi mật khẩu root. Giữ mật khẩu mới trong trình quản lý mật khẩu của bạn.

```bash
cat /etc/os-release
uname -m
nproc
free -h
df -h /
systemd-detect-virt
sudo -v
```

Kiểm tra Debian 12, kiến trúc, CPU/RAM/disk thực tế và quyền sudo. Dung lượng hiển thị có thể thấp hơn thông số quảng cáo do đơn vị đo và phần hệ thống.

Nếu `sudo` không tồn tại hoặc user chưa có quyền, dùng `su -` và mật khẩu root để vào root, rồi:

```bash
apt update
apt install -y sudo
usermod -aG sudo user
exit
```

Đóng và mở lại phiên SSH để quyền mới có hiệu lực. Nếu cả root lẫn sudo không sử dụng được, cần bên bán cấp quyền quản trị trước khi cài dịch vụ. Nếu máy là container LXC/OpenVZ và Docker không khởi động được, cần bên bán hỗ trợ nesting/đặc quyền hoặc chuyển sang máy hỗ trợ Docker; không thay đổi quyền kernel tùy tiện.

## 3. Cài Docker trên Debian 12

Nếu VPS đã có Docker và `sudo docker compose version` chạy được, dùng bản có sẵn. Với máy mới chưa cài Docker, chạy các bước sau theo [tài liệu chính thức Docker](https://docs.docker.com/engine/install/debian/):

```bash
sudo apt update
sudo apt install -y ca-certificates curl git openssl nano
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo docker run --rm hello-world
```

`hello-world` chạy thành công xác nhận Docker có thể tải và chạy container. Không cần cài Node.js, PostgreSQL, Redis hoặc Nginx riêng trên host: chúng nằm trong container. Nếu VPS đã cài Docker từ nguồn khác, đối chiếu mục prerequisite của tài liệu Docker trước khi thay gói; không gỡ dịch vụ đang chạy.

## 4. Đưa bản mã nguồn đã sửa lên VPS

Bản triển khai hiện tại có nhiều thay đổi chưa commit, nên `git clone` riêng từ GitHub có thể không chứa các bản sửa này. Một archive từ workspace hiện tại đã được chuẩn bị ở root: `tricehsk-deploy.tar.gz`. Archive chỉ chứa nguồn cần build và cấu hình, không chứa `.env`, mật khẩu bàn giao, node_modules, dataset hoặc database.

Trong **PowerShell Windows**, tại `D:\trice_hsk`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\package.ps1
scp .\tricehsk-deploy.tar.gz user@100.104.108.58:~/
```

Trong **terminal VPS**:

```bash
mkdir -p ~/trice_hsk
tar -xzf ~/tricehsk-deploy.tar.gz -C ~/trice_hsk
cd ~/trice_hsk/deploy
bash init-env.sh
nano .env
```

`init-env.sh` tạo `.env` quyền 600 và sinh riêng từng khóa/mật khẩu ngẫu nhiên. Nếu `.env` đã tồn tại, script giữ nguyên, không thay mật khẩu database hay JWT. Trong nano, sửa `SEED_ADMIN_EMAIL` thành email của bạn; lưu mật khẩu `SEED_ADMIN_PASSWORD` trong trình quản lý mật khẩu. `Ctrl+O` rồi Enter để lưu, `Ctrl+X` để thoát.

Các cấu hình ban đầu:

| Biến | Ý nghĩa |
| --- | --- |
| `FRONTEND_DOMAIN`, `BACKEND_DOMAIN` | `http://localhost:8080` khi mở web qua SSH tunnel trên Windows |
| `APP_CORS_ORIGINS` | Địa chỉ dashboard và frontend local được phép gọi API; bổ sung origin của thành viên frontend nếu dùng cổng khác |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Tài khoản quản trị ứng dụng, độc lập với tài khoản Linux |
| `MAIL_*` | Mặc định email thử nghiệm được giữ trong Maildev; chưa gửi ra hộp thư thật |
| `GEMINI_API_KEY` | Điền khi cần chấm bài viết bằng AI; để trống thì chức năng đó trả lỗi chưa cấu hình |
| `DATABASE_MAX_CONNECTIONS` | 10 kết nối ứng dụng, phù hợp làm điểm bắt đầu cho máy nhỏ |

Compose cấp database/Redis host nội bộ cho API. Không đổi `DATABASE_SYNCHRONIZE` sang true; dùng migration. Sửa `DATABASE_PASSWORD` trong `.env` sau khi database đã khởi tạo không tự đổi mật khẩu trong PostgreSQL.

## 5. Build tuần tự để tiết kiệm RAM

Trong VPS, từ `~/trice_hsk/deploy`:

```bash
sudo docker compose config --quiet
sudo docker compose build api
sudo docker compose build admin
sudo docker compose build maildev
```

Build Next.js có thể mất nhiều phút trên 1 vCPU và cần tải font Google. Build tuần tự, không build đồng thời nhiều dịch vụ. Nếu bị `Killed`/OOM hoặc VPS không tải được font, dừng để xử lý nguyên nhân; có thể build image Linux trên máy khác/CI rồi chuyển vào VPS. Không cần cài lại VPS.

## 6. Tạo database và tài khoản quản trị

```bash
sudo docker compose up -d --wait postgres redis maildev
sudo docker compose run --rm --no-deps api node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run
sudo docker compose run --rm --no-deps api node dist/database/seeds/relational/run-seed.js
sudo docker compose up -d --wait api admin web
sudo docker compose ps
curl -fsS http://127.0.0.1:8080/health
```

Chỉ tiếp tục khi PostgreSQL/Redis đã healthy và migration thành công. Seed tạo role, status và admin đầu tiên, không chạy mỗi lần cập nhật. Dùng `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` để đăng nhập dashboard. Tài khoản `user` của Debian không phải tài khoản dashboard.

Nếu áp dụng lên database đã có dữ liệu, backup trước và đối chiếu lịch sử migration; không chạy schema drop hoặc tự xóa volume khi migration báo lỗi. Archive không chứa nội dung học hoặc dữ liệu từ database local của bạn; nhập nội dung qua admin hoặc có kế hoạch chuyển dữ liệu riêng.

## 7. Mở dashboard và Swagger trên Windows

Mở **một cửa sổ PowerShell Windows mới**, giữ Tailscale đang bật:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:8080:127.0.0.1:8080 -L 127.0.0.1:1080:127.0.0.1:1080 user@100.104.108.58
```

Sau khi nhập mật khẩu, cửa sổ có thể không hiện gì; giữ nó mở. Đây là đường chuyển tiếp cổng, không phải phiên để gõ lệnh VPS.

Mở trên trình duyệt Windows:

- Dashboard: `http://localhost:8080`
- Swagger: `http://localhost:8080/docs`
- API: `http://localhost:8080/api/v1`
- Hộp email thử nghiệm: `http://localhost:1080`
- Kiểm tra tiến trình API: `http://localhost:8080/health`

`/health` chỉ xác nhận API trả lời, không thay thế kiểm tra toàn bộ chức năng/DB/Redis/email. Mỗi thành viên được phép SSH vào VPS có thể mở tunnel tương tự trên máy của họ. Trong frontend local, cấu hình base URL `http://localhost:8080/api/v1`; backend đã cho phép origin `http://localhost:3000`. Bổ sung origin cần thiết vào `.env`, rồi chạy `sudo docker compose up -d api`.

PostgreSQL và Redis không publish cổng ra host. Nginx chỉ bind `127.0.0.1:8080`, Maildev chỉ bind `127.0.0.1:1080`. Vì vậy chỉ cài Tailscale rồi mở `http://100.104.108.58:8080` sẽ không vào được; dùng SSH tunnel như trên. Không mở dashboard/Maildev công khai bằng cách đổi bind thành `0.0.0.0` cho tiện.

## 8. Kiểm tra trước khi giao API cho frontend

- Đăng nhập dashboard bằng admin, tạo một tài khoản học viên thử với trạng thái active và mật khẩu riêng.
- Học viên đăng nhập được, đọc nội dung được, bị từ chối khi gọi API ghi nội dung/quản trị.
- Tài khoản đăng ký mới ở trạng thái pending; admin phải duyệt trước khi học viên đăng nhập.
- Với đăng ký/quên mật khẩu, email thử xuất hiện trong Maildev. Các trang nhận link xác nhận/reset còn cần thành viên frontend xây dựng; có thể kiểm tra API qua Swagger trước.
- Tạo từ vựng, câu hỏi, bài luyện tập/đề thi thử; upload audio rồi mở URL file trả về.
- Thử refresh token và logout; dữ liệu và file vẫn tồn tại khi chạy `sudo docker compose restart api`.
- Chấm phát âm, game đầy đủ và nộp/lưu bài thi chưa hoàn chỉnh; phạm vi bản thử phải dựa trên API thật, xem `backend/docs/backend-review.md`.

## 9. Theo dõi và xử lý lỗi

Nếu nhấn nút đăng nhập mà không có phản hồi, bản source ban đầu thiếu `type="submit"` trên nút dùng component `Button` (mặc định `type="button"`). Bản source đã sửa; phải build/recreate dashboard trên đúng VPS để trang phục vụ thay đổi. Chạy `bash fix-admin-login.sh` từ thư mục deploy để sửa đúng trường hợp source cũ, build/recreate admin + web và kiểm tra HTML trả về qua Nginx. Nếu đã bật cấu hình Cloudflare Tunnel, dùng `bash fix-admin-login.sh --tunnel` để giữ đúng hai file Compose. Script không chạy migration/seed hoặc thay mật khẩu/database.

Nếu Windows đang có dịch vụ khác trên cổng 8080, mở tunnel riêng tới VPS bằng `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18080:127.0.0.1:8080 user@100.104.108.58`, rồi truy cập `http://127.0.0.1:18080/signin`. Cổng 18080 ở Windows chuyển tới cổng 8080 ở VPS. Kiểm tra nội dung trang phục vụ trước khi coi lỗi đó là lỗi mật khẩu hoặc `router.push`.

Khi nút đã gửi POST nhưng API trả 422, đọc JSON trong tab Network/Response. `errors.status=accountNotActive` là trạng thái chưa hoạt động; `incorrectEmailOrPassword` là thông báo thống nhất cho email/mật khẩu/provider không hợp lệ; lỗi validation cũng trả 422. Seed chỉ tạo admin lần đầu, không tự cập nhật mật khẩu/email admin đã tồn tại khi bạn sửa `.env`.

Để đối chiếu tài khoản với cấu hình mà không sửa database hoặc in mật khẩu, chuyển `check-admin-login.cjs` lên thư mục deploy và chạy trong VPS:

```bash
cd ~/trice_hsk/deploy
sudo docker compose run --rm --no-deps -v "$PWD/check-admin-login.cjs:/app/check-admin-login.cjs:ro" api node /app/check-admin-login.cjs EMAIL_DANG_DANG_NHAP
```

Thay `EMAIL_DANG_DANG_NHAP` bằng email trong form. Script khóa transaction ở chế độ read-only, in email/trạng thái/role và cờ `configuredPasswordMatchesStoredPassword`; không in mật khẩu/hash/token, không chạy migration/seed hoặc thay tài khoản. Nếu đang dùng tunnel, thêm `-f compose.yaml -f compose.tunnel.yaml` ngay sau `docker compose`. Không reset hoặc cấp quyền admin cho tài khoản khác khi chưa xác định đúng tài khoản cần xử lý.

Chạy từ `~/trice_hsk/deploy`:

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 api
sudo docker compose logs --tail=100 admin web
sudo docker stats --no-stream
free -h
df -h /
```

| Hiện tượng | Kiểm tra |
| --- | --- |
| SSH timeout | Tailscale bật/đúng mạng, VPS đang online, quyền truy cập và cổng SSH |
| `Address already in use` khi mở tunnel | Cổng 8080/1080 trên Windows đang bị chương trình khác sử dụng |
| Web 502 | API/admin có đang chạy, API healthy, log build/startup |
| API lỗi kết nối DB | PostgreSQL healthy, database/password đúng, migration đã chạy |
| Auth trả 429 | Chờ hết cửa sổ 60 giây; ban đầu limit 10 yêu cầu/IP/endpoint/phút |
| Không nhận email thật | Maildev chỉ giữ thư thử; muốn gửi thật phải cấu hình SMTP |
| Build Inter/font thất bại | Kết nối từ máy build đến Google Fonts; không tự bỏ qua lỗi build |
| Container bị OOM | RAM/build quá tải, xem `docker stats`, build trên CI/máy khác hoặc nâng gói |

Trong cách truy cập SSH tunnel này, Nginx có thể thấy nhiều người dùng chung địa chỉ nguồn của kết nối chuyển tiếp. Vì vậy rate limit theo IP không phải giới hạn riêng từng tài khoản; không thử đăng nhập hàng loạt cùng lúc rồi coi 429 là lỗi tài khoản. Khi mở public cần xác định lại chuỗi proxy, IP client và rate limit.

Compose đã giới hạn log tối đa khoảng 30 MB mỗi dịch vụ và có restart policy. Docker giữ dịch vụ chạy sau khi bạn đóng SSH. Trước khi đổi firewall hoặc mạng, phải giữ đường truy cập Tailscale/SSH hoạt động; hướng dẫn này không tự sửa firewall.

### Đổi thông tin đăng nhập của admin đã tạo

Sửa `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` trong `.env` không cập nhật tài khoản đã tồn tại. Sau khi xác định ID/email hiện tại bằng truy vấn chỉ đọc ở trên, dùng `reset-admin-login.cjs` để áp dụng thông tin mới từ `.env`. Lệnh này thay email/mật khẩu của đúng admin đang hoạt động, giữ ID/username/quyền, thu hồi các phiên cũ và xóa xác minh email nếu email thay đổi. Không tạo tài khoản hay cấp thêm quyền admin.

Chép script từ PowerShell trên Windows (không chạy đường dẫn `D:\...` trong SSH):

```powershell
scp "D:\trice_hsk\deploy\reset-admin-login.cjs" user@100.104.108.58:/home/user/trice_hsk/deploy/
```

Trên VPS, thay `ADMIN_ID` và `EMAIL_HIEN_TAI` bằng thông tin vừa đọc từ database; mật khẩu mới phải có ít nhất 12 ký tự và không quá 72 byte UTF-8:

```bash
cd ~/trice_hsk/deploy
sudo docker compose run --rm --no-deps -v "$PWD/reset-admin-login.cjs:/app/reset-admin-login.cjs:ro" api node /app/reset-admin-login.cjs ADMIN_ID EMAIL_HIEN_TAI
```

Nếu đang dùng Cloudflare Tunnel, thêm `-f compose.yaml -f compose.tunnel.yaml` sau `docker compose`. Chỉ đăng nhập bằng thông tin mới khi thấy `ADMIN_LOGIN_UPDATED`. Script không in mật khẩu/hash/token và thực hiện cập nhật tài khoản/thu hồi phiên trong cùng transaction. Nếu email mới trùng email hoặc username của tài khoản khác, script từ chối cập nhật. Không cần build lại hoặc restart API. Sau khi email thay đổi, chạy lại lệnh với email cũ sẽ bị từ chối; đọc lại tài khoản trước khi thực hiện lần nữa.

## 10. Backup và khôi phục

Để chuyển dữ liệu đã có trên máy Windows lên VPS mới, xem [hướng dẫn nhập dữ liệu localhost](LOCAL_DATA.md). Gói mã nguồn không chứa database hay file upload.

Từ VPS:

```bash
cd ~/trice_hsk/deploy
sudo bash backup.sh
```

Mỗi thư mục `backups/<thoi-diem-UTC>/` gồm database dump, file upload và cấu hình bí mật. Script giữ quyền truy cập backup cho người sở hữu `.env`, kể cả khi chạy bằng root/cron. Chọn thời điểm không có người ghi/upload; PostgreSQL dump có snapshot riêng nhưng dump DB và archive file không phải snapshot nguyên tử của cả ứng dụng. Không gửi file backup cho người không có quyền. Tải bản sao ra ngoài VPS, ví dụ trên Windows:

```powershell
scp -r user@100.104.108.58:~/trice_hsk/deploy/backups .\vps-backups
```

Đặt lịch backup mỗi ngày bằng cron sau khi thử script thành công; ví dụ `sudo crontab -e`, thêm:

```text
0 3 * * * cd /home/user/trice_hsk/deploy && /bin/bash backup.sh >> /var/log/tricehsk-backup.log 2>&1
```

Cron lưu theo timezone VPS (`timedatectl` để xem). Tự động sao chép bản backup ra kho/máy khác và dọn bản cũ theo thời hạn lưu; script không tự xóa backup, cần theo dõi disk 40 GB.

Khôi phục phải thử trên máy/database riêng trước. Với deployment mới, trống, đã build image và có PostgreSQL healthy, dùng đường dẫn thư mục backup thật thay `backups/THOI_DIEM`:

```bash
sudo docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error' < backups/THOI_DIEM/database.dump
sudo docker compose run --rm --no-deps --entrypoint tar api -xzf - -C /app/files < backups/THOI_DIEM/uploads.tar.gz
sudo docker compose up -d api admin web
```

Đây là lệnh khôi phục vào database/volume trống, không chạy migration/seed trước restore; không áp dụng lên DB đang sử dụng. Cấu hình deployment đích cần credentials tương ứng, và giữ khóa JWT/email/provider từ backup nếu muốn giữ tính tương thích phiên/link. Không dùng `--clean` để ghi đè dữ liệu đang hoạt động. Sau restore, kiểm tra đăng nhập, bản ghi và audio. Với DB đã có dữ liệu, lập phương án riêng.

## 11. Cập nhật backend sau này

Nếu đã cài CI/CD, dùng [quy trình tự động](CI_CD.md) và `sudo tricehsk-compose ...` để giữ image phiên bản hiện tại. Các lệnh build/up thủ công bên dưới dành cho deployment chưa bật CI/CD.

Không cần cấu hình lại Debian/Docker mỗi lần sửa code. Khi nhóm đã đưa các thay đổi vào Git, dùng Git để lấy bản mới; hoặc tạo lại archive từ workspace đã sửa và upload như bước 4. Archive chỉ thay code, giữ nguyên `.env` và Docker volumes.

```bash
cd ~/trice_hsk/deploy
sudo bash backup.sh
sudo docker compose build api
sudo docker compose run --rm --no-deps api node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run
sudo docker compose up -d api
sudo docker compose up -d --force-recreate web
sudo docker compose ps
curl -fsS http://127.0.0.1:8080/health
```

Build không tự chạy migration. Với migration thay đổi schema không tương thích bản API cũ, cần lên lịch bảo trì và dừng API trước migration. Với thay đổi tương thích, quy trình trên giữ API cũ trong lúc build rồi thay container, có gián đoạn ngắn; chưa phải triển khai không downtime. Nginx được tạo lại để cập nhật địa chỉ container API.

Nếu sửa frontend admin, build và cập nhật thêm:

```bash
sudo docker compose build admin
sudo docker compose up -d admin
sudo docker compose up -d --force-recreate web
```

Không chạy `docker compose down -v`, `docker volume prune` hoặc lệnh schema drop trong quá trình cập nhật. Các lệnh đó có thể xóa dữ liệu. Không đổi tên project Compose `tricehsk` khi cập nhật vì volume gắn theo tên project.

## 12. Khi muốn mở cho người ngoài nhóm và thêm tên miền

Với `tricehsk.id.vn` và VPS đang dùng địa chỉ nội bộ `10.10.10.103`, xem [hướng dẫn Cloudflare Tunnel](CLOUDFLARE.md). Cấu hình này tách dashboard/admin và API, giữ PostgreSQL/Redis/Maildev riêng, và chỉ tin header IP client từ connector trong mạng Docker dành riêng.

Tên miền bổ sung sau được. Dashboard được build với API tương đối `/api/v1`, nên đổi địa chỉ cùng origin không cần build lại chỉ vì tên miền.

- **Chưa có tên miền, muốn demo công khai:** [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) có thể cấp URL HTTPS dạng `*.ts.net` nếu bạn có quyền bật Funnel/MagicDNS/HTTPS trong mạng quản lý VPS. Funnel có giới hạn băng thông và chỉ dùng tên DNS trong miền tailnet; không trỏ thẳng tên miền riêng vào nó. Link mời chưa đảm bảo bạn có các quyền này. Trước khi bật, xác định phạm vi sẽ public, chuẩn bị tài khoản/SMTP và cập nhật origin theo URL được cấp. Bộ compose này không tự bật Funnel.
- **Có IP public hoặc port forwarding phù hợp:** mua tên miền, trỏ DNS tới IP public theo hướng dẫn bên bán, thêm HTTPS reverse proxy (Caddy/Nginx) ở phía host trước `127.0.0.1:8080`. Không trỏ DNS tới `100.104.108.58`.
- **Chỉ có Tailscale/NAT, muốn tên miền riêng:** cân nhắc [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), cấu hình hostname tới dịch vụ nội bộ qua connector. Kiểm tra quyền quản lý domain, mạng outbound và yêu cầu dịch vụ trước khi chọn.

Khi thêm proxy/tunnel, cấu hình lại nguồn IP tin cậy và forwarded headers; `APP_TRUST_PROXY=1` hiện dành cho một Nginx duy nhất, không tự coi mọi `X-Forwarded-For` từ Internet là tin cậy. Cập nhật `FRONTEND_DOMAIN`, `BACKEND_DOMAIN`, CORS theo HTTPS origin thật, chuyển SMTP sang dịch vụ gửi email thật, không public Maildev. Nếu giao diện học viên có hostname riêng, đưa origin đó vào CORS và API base URL frontend.

Việc mua tên miền không hoàn thiện giao diện học viên hoặc nghiệp vụ nộp bài đang thiếu. Trước khi mời học viên thật, kiểm tra luồng học/làm bài trên môi trường thực và đo tải theo cách sử dụng dự kiến.

## Sửa URL ảnh khi xem qua SSH tunnel

Dashboard dùng `resolveFileUrl` để tải ảnh local `/api/v1/files/...` qua API base đang cấu hình, thay vì giữ hostname trong URL backend trả về. Bản build `/api/v1` dùng cùng origin cho web/API/ảnh, hỗ trợ cả domain admin và SSH tunnel khi domain API chưa Active. Đường dẫn Windows được chuẩn hóa; URL ảnh bên ngoài/S3 có chữ ký được giữ.

Gói `tricehsk-media-fix.tar.gz` chỉ có script và bốn file nguồn giao diện. Upload từ Windows vào `/home/user/`, giải nén trong `~/trice_hsk/deploy`, chạy `bash fix-media-urls.sh --tunnel`. Script giữ bản nguồn/image trước đó, build admin rồi tạo lại admin/web; kiểm tra trang signin và client bundle thực tế trước khi báo `MEDIA_URL_FIX_OK`. Build lỗi giữ container cũ; lỗi sau cutover thử khôi phục image admin cũ. API/database/upload volume không được thay đổi. Nếu CI/CD đang quản lý image, dùng workflow để xuất bản bản sửa. Đăng nhập lại sau lần nhập dữ liệu vì session cũ đã bị thu hồi.

Kiểm tra: 7 test URL ảnh, lint helper, dashboard build 39 trang; script được kiểm thử mô phỏng thành công/build lỗi/bundle lỗi và qua ShellCheck. Chưa áp dụng bản vá lên VPS từ agent.

## Trạng thái kiểm chứng

Cấu hình chuẩn bị trên Windows. Backend đã qua lint, typecheck, 144 test và build; dashboard build thành công 39 trang và có standalone entry point. Compose được kiểm tra bằng CLI, kiểm tra đường dẫn Dockerfile và cổng private; hai script Bash qua kiểm tra cú pháp/LF. Thử script init trên thư mục tạm xác nhận sinh 6 khóa độc lập và chạy lại không thay cấu hình. Archive được kiểm tra không chứa `.env`, node_modules, backup hay dataset.

Lúc kiểm tra bộ Compose ban đầu, Docker daemon local chưa truy cập được. Sau đó cấu hình Cloudflare Tunnel đã được bổ sung và kiểm tra cú pháp bằng container Nginx Linux thật; xem `CLOUDFLARE.md`. Chưa chạy toàn bộ stack, thử backup/restore với bộ Compose này hoặc triển khai từ agent lên VPS. Các bước này cần xác nhận khi bạn thực hiện hướng dẫn. Tài liệu không khẳng định web đã online.
