# Nối tricehsk.id.vn với VPS qua Cloudflare Tunnel

VPS hiện có IP LAN `10.10.10.103`, IP Tailscale `100.104.108.58` và chưa thấy IPv6 public. Điều này không loại trừ port forwarding ở bên bán, nhưng chưa có thông tin xác nhận. Phương án tunnel không cần IP public riêng hoặc cổng 80/443 inbound.

| Địa chỉ | Mục đích |
| --- | --- |
| `https://admin.tricehsk.id.vn` | Dashboard quản trị, dùng API cùng origin `/api/v1` |
| `https://api.tricehsk.id.vn/api/v1` | Backend cho frontend học viên và nhóm tích hợp |
| `https://api.tricehsk.id.vn/docs` | Swagger |
| `https://tricehsk.id.vn` | Dành cho giao diện học viên sau này; chưa tạo route tới dashboard |

Đây là bộ cấu hình chuẩn bị tại workspace, chưa thay DNS/TenTen, tạo tunnel hoặc truy cập tài khoản Cloudflare của bạn. Trước khi tạo route public, kiểm tra các bước chạy ứng dụng bên dưới.

## 1. Khởi động ứng dụng đã build

Trong terminal VPS:

```bash
cd ~/trice_hsk/deploy
sudo docker compose up -d --wait postgres redis maildev
sudo docker compose run --rm --no-deps api node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run
sudo docker compose run --rm --no-deps api node dist/database/seeds/relational/run-seed.js
sudo docker compose up -d --wait api admin web
sudo docker compose ps
curl -fsS --max-time 15 http://127.0.0.1:8080/health
```

Chạy lần lượt, dừng khi có lỗi. Nếu đã chạy migration/seed trước đó thì không phải tạo lại database; tuyệt đối không xóa volumes. Đăng nhập thử admin qua SSH tunnel như README chính trước khi publish.

Kiểm tra VPS kết nối ra ngoài được:

```bash
curl -I --max-time 15 https://www.cloudflare.com
```

Có HTTP response xác nhận DNS/HTTPS outbound tới website này; chưa chứng minh cổng tunnel 7844 thông. Nếu connector không kết nối, kiểm tra outbound TCP/UDP 7844 theo [yêu cầu firewall của Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/). Không mở PostgreSQL/Redis/Maildev ra Internet.

## 2. Đưa DNS tên miền sang Cloudflare

Theo [hướng dẫn full setup chính thức](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/):

1. Đăng nhập tài khoản Cloudflare của bạn và thêm domain `tricehsk.id.vn`. Chọn gói Free cho bước thiết lập ban đầu nếu dashboard cung cấp lựa chọn đó; không cần mua domain lần nữa.
2. Rà soát record được Cloudflare tìm thấy. Ảnh TenTen hiện chưa có record; nếu từ đó bạn đã cấu hình email/record khác, giữ và chuyển đủ các record đó.
3. Cloudflare cấp **hai nameserver riêng cho domain/tài khoản của bạn**. Sao chép đúng hai tên, không dùng nameserver mẫu từ người khác.
4. Trong trang quản lý tên miền TenTen, tìm phần **thay đổi Name Server/Nameserver**, không phải nút **Thêm bản ghi DNS** trong ảnh. Thay bộ NS `ns-b1.tenten.vn`, `ns-b2.tenten.vn`, `ns-b3.tenten.vn` bằng hai NS được Cloudflare cấp. Nếu không thấy chức năng này, dùng trang quản lý tên miền hoặc hỏi hỗ trợ TenTen.
5. Nếu DNSSEC đang bật ở registrar, xử lý theo hướng dẫn Cloudflare trước khi đổi NS, rồi bật lại đúng cách khi domain Active. Chờ Cloudflare xác nhận domain **Active**. Không bảo đảm thời gian cố định; có thể mất nhiều giờ.

Trên Windows có thể kiểm tra:

```powershell
nslookup -type=ns tricehsk.id.vn 1.1.1.1
```

Không thêm record A tới `10.10.10.103`, `100.104.108.58`, IP Docker hoặc một IP egress chưa xác nhận inbound. Domain vẫn được đăng ký/gia hạn ở TenTen; Cloudflare quản lý DNS sau khi đổi NS.

## 3. Chuyển cấu hình tunnel mới lên VPS

File compose/nginx mới chỉ có trong bản source vừa chuẩn bị. Trên Windows, tạo lại archive và upload:

```powershell
cd D:\trice_hsk
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy\package.ps1
scp .\tricehsk-deploy.tar.gz user@100.104.108.58:/home/user/
```

Trên VPS:

```bash
tar -xzf ~/tricehsk-deploy.tar.gz -C ~/trice_hsk
cd ~/trice_hsk/deploy
```

Archive không chứa `.env` hay `cloudflare.env`, không thay khóa/mật khẩu hiện có, và không xóa database. Với thay đổi tunnel này, không cần rebuild API/admin đã build thành công.

## 4. Tạo tunnel và lưu token riêng

Để dùng script hỗ trợ với bộ ứng dụng đã chạy: giải nén gói cấu hình `tricehsk-cloudflare.tar.gz` vào `~/trice_hsk/deploy`, rồi chạy `bash start-cloudflare-tunnel.sh` trên VPS. Script nhận nguyên lệnh Docker Cloudflare hoặc riêng token qua input ẩn, chỉ trích token (không thực thi lệnh được dán), lưu `cloudflare.env` quyền 600 và cập nhật các origin. Database, mật khẩu ứng dụng và `UPLOADS_VOLUME_NAME` được giữ nguyên. API/Web được tạo lại, cloudflared được khởi động, không build lại hoặc chạy seed/migration. Có gián đoạn ngắn lúc tạo lại container. Nếu thiết lập lỗi, script thử phục hồi origin trước đó. `CLOUDFLARE_CONNECTOR_STARTED` chỉ xác nhận đã khởi động container, cần dashboard báo Connected/Healthy trước khi thêm route.

Script giữ CORS cho `127.0.0.1:18080` và `localhost:18080` để SSH tunnel hiện tại vẫn dùng được. Sau khi chuyển hẳn sang tên miền, có thể thu hẹp danh sách origin theo frontend nhóm thực sự dùng.

Theo [hướng dẫn Cloudflare](https://developers.cloudflare.com/tunnel/get-started/), mở mục **Networking > Tunnels** trong dashboard (giao diện có thể dẫn qua Cloudflare One). Tạo tunnel loại `cloudflared`, đặt tên như `tricehsk-vps`, chọn hướng dẫn Docker.

Dashboard có lệnh mẫu chứa `--token ...`. Lấy đúng token connector của tunnel vừa tạo và lưu vào file trên VPS, không gửi token trong chat/ảnh. Không chạy nguyên lệnh Docker mẫu vì cấu hình dự án sử dụng mạng/headers riêng.

```bash
cd ~/trice_hsk/deploy
cp -n cloudflare.env.example cloudflare.env
chmod 600 cloudflare.env
nano cloudflare.env
```

Thay placeholder sau `TUNNEL_TOKEN=` bằng token thật, không thêm dấu cách. Lưu bằng Ctrl+O, Enter, Ctrl+X. File này chỉ được đưa vào connector, không đưa token vào môi trường API.

Sửa `.env` của ứng dụng:

```bash
nano .env
```

Cập nhật ba dòng, giữ các mật khẩu/khóa khác:

```dotenv
FRONTEND_DOMAIN=https://admin.tricehsk.id.vn
BACKEND_DOMAIN=https://api.tricehsk.id.vn
APP_CORS_ORIGINS=https://admin.tricehsk.id.vn,https://tricehsk.id.vn,http://localhost:3000,http://localhost:8080
```

`FRONTEND_DOMAIN` hiện trỏ admin cho giai đoạn thử nghiệm; trang xác nhận/reset email chưa có trên admin. Khi giao diện học viên có các trang nhận link, đổi sang origin của giao diện đó. Maildev vẫn chỉ giữ thư thử, chưa gửi thư ra hộp thật. Các tài khoản đang dùng password admin/user phải đã được đổi như hướng dẫn trước khi public.

## 5. Bật connector và kiểm tra origin

Luôn dùng **hai file Compose** cho deployment này, kể cả các lần cập nhật sau:

```bash
sudo docker compose -f compose.yaml -f compose.tunnel.yaml config --quiet
sudo docker compose -f compose.yaml -f compose.tunnel.yaml up -d --wait api admin web cloudflared
sudo docker compose -f compose.yaml -f compose.tunnel.yaml ps
sudo docker compose -f compose.yaml -f compose.tunnel.yaml logs --tail=30 cloudflared
```

Connector chạy trên IP tĩnh `172.30.90.2`, web trên `172.30.90.3` trong mạng Docker `172.30.90.0/29`. Nginx chỉ tin `CF-Connecting-IP` và scheme từ connector đó, sau đó gửi một IP client đã xác minh tới NestJS (`APP_TRUST_PROXY=1`). Nginx không tin header IP do người ngoài gửi trực tiếp.

Nếu subnet này trùng mạng hiện có và Docker báo overlap, chọn subnet riêng rồi sửa đồng bộ địa chỉ ở compose và nginx; không xóa mạng/route đang dùng. API và database giữ mạng default, connector chỉ tham gia mạng tunnel. Cổng web host vẫn chỉ `127.0.0.1:8080`; không cần mở firewall inbound.

Kiểm tra API trả lời theo hostname, và nginx nhận cấu hình:

```bash
sudo docker compose -f compose.yaml -f compose.tunnel.yaml exec web nginx -t
curl -fsS --max-time 15 -H 'Host: api.tricehsk.id.vn' http://127.0.0.1:8080/health
```

Đợi tunnel Healthy/Connected ở dashboard; log phải có kết nối được đăng ký, không liên tục retry lỗi.

## 6. Thêm hai Published application routes

Trong tunnel vừa tạo, thêm route cho hai hostname. **Không publish hostname tới khi origin/đăng nhập đã được thử thành công.**

| Subdomain | Domain | Service type | Service URL | Path |
| --- | --- | --- | --- | --- |
| `admin` | `tricehsk.id.vn` | HTTP | `web:8080` | để trống |
| `api` | `tricehsk.id.vn` | HTTP | `web:8080` | để trống |

`web` là tên service Docker mà connector có thể truy cập. **Không dùng `localhost:8080` trong cấu hình tunnel này**: trong container cloudflared, localhost là chính connector. Giữ Host Header mặc định, không đổi thành `web` để nginx phân biệt domain API/admin. Dashboard tạo DNS route phù hợp trên Cloudflare; không thêm lại record tương ứng ở TenTen.

Bật chuyển hướng Always Use HTTPS trong cấu hình domain khi có chứng chỉ edge hoạt động. Nếu nhóm muốn thêm lớp đăng nhập Cloudflare Access cho admin, áp dụng cho `admin.tricehsk.id.vn` với email nhóm; không vô tình áp dụng chính sách đó lên API dành cho học viên. Backend vẫn kiểm tra token, role và trạng thái.

Kiểm tra bằng trình duyệt không bật Tailscale:

- `https://admin.tricehsk.id.vn/signin`: đăng nhập admin.
- `https://api.tricehsk.id.vn/health`: API phản hồi.
- `https://api.tricehsk.id.vn/docs`: xem Swagger.
- Tạo/sửa dữ liệu thử, refresh/logout, audio và quyền học viên qua hostname thật.

Nếu redirect dẫn về `localhost`, `0.0.0.0` hoặc HTTP, dừng public route và kiểm tra Host/forwarded headers cùng cấu hình Next.js trước khi giao cho nhóm. `/health` không thay thế kiểm tra các luồng này. Nếu lỗi CORS, đối chiếu origin frontend với `.env` và recreate API.

## 7. Cập nhật, tắt tunnel và những phần còn thiếu

- Khi sửa backend, dùng hai file compose để build/run migration/update như README chính; giữ `cloudflare.env`. Nếu cập nhật/recreate API/admin, recreate web để Nginx cập nhật địa chỉ upstream. Không chạy lại compose base một mình vì sẽ quay về config private và bỏ mạng tunnel khỏi web.
- Khi muốn tắt public connector: `sudo docker compose -f compose.yaml -f compose.tunnel.yaml stop cloudflared`. API/database vẫn tồn tại, SSH/Tailscale vẫn truy cập được.
- SMTP thật, giao diện học viên và nghiệp vụ nộp/lưu bài thi còn cần hoàn thiện. Tên miền hoạt động không chứng minh cả sản phẩm đã sẵn sàng cho học viên thật.
- Bổ sung `cloudflare.env` vào kế hoạch sao lưu bí mật riêng nếu cần khôi phục connector; không đưa file vào archive source/Git. Khi mất/thu hồi token, tạo lại từ Cloudflare dashboard và recreate connector.

Đã kiểm tra Compose sau khi ghép hai file, volume override Nginx, cổng private và địa chỉ connector. `nginx -t` thành công trong container Nginx Linux thật với upstream giả để kiểm tra cú pháp. Smoke check standalone Next.js với Host `admin.tricehsk.id.vn`/forwarded HTTPS trả 307 tới đường dẫn tương đối `/signin`, không redirect tới IP nội bộ trong kiểm tra đó.

DNS, token, TLS, network outbound, header IP client qua tunnel thật và luồng đăng nhập đầy đủ cần kiểm tra trên VPS/tài khoản của bạn; chưa có thao tác publish ở đây.
