# Báo cáo rà soát backend — 09/10/2026

Backend ban đầu chưa đạt mức sạch và nhất quán: lint báo 1.665 lỗi trên 229 file, chưa có unit test, một số API ghi nội dung chưa có phân quyền, DTO chưa bảo vệ dữ liệu đầu vào và cache đề thi có thể trả nhầm đề.

Đợt này rà soát toàn bộ `src`/`test` bằng lint và TypeScript, đồng thời kiểm tra các luồng chính: xác thực, người dùng, phân quyền, câu hỏi, bài luyện tập, đề thi, từ vựng, analytics, audit log, game realtime, upload và AI. Các script nhập liệu/PDF và dataset bên ngoài `src` không được coi là ứng dụng production; riêng `create-admin.ts` đã sửa và đưa vào lint/typecheck.

## Những thay đổi đã thực hiện

| Phần | Vấn đề trước đây | Cách sửa |
| --- | --- | --- |
| Phân quyền nội dung | Đề thi/từ vựng có API ghi công khai; học viên đã duyệt sửa được câu hỏi và bài luyện tập | Decorator `ContentEditor` yêu cầu JWT, tài khoản hoạt động và vai trò admin/giảng viên |
| Audit và thống kê quản trị | Người dùng hoạt động truy cập được nhật ký và thống kê quản trị | Audit chỉ dành cho admin; thống kê quản trị dành cho admin/giảng viên |
| JWT | Token cũ giữ quyền/trạng thái cũ và còn dùng được sau đăng xuất | Kiểm tra phiên/tài khoản hiện tại, trả quyền và trạng thái từ database; đổi mật khẩu quản trị thu hồi phiên |
| Trạng thái tài khoản | Social login cấp phiên cho tài khoản pending/inactive; refresh vẫn cấp token khi bị khóa | Kiểm tra trạng thái hoạt động trên các luồng đăng nhập và refresh; xóa tài khoản thu hồi phiên |
| Xác nhận email | Đăng ký pending nhưng xác nhận chỉ nhận inactive; các loại link dùng chung payload | Thêm `emailVerifiedAt` vào hai lớp persistence, giữ trạng thái phê duyệt; token có purpose và email hiện tại; có API gửi lại link |
| Tra cứu tài khoản | Tìm email bằng cả email và username nên reset mật khẩu/social login có thể chọn nhầm tài khoản | Tách `findByEmail` và `findByLogin`; đăng nhập ưu tiên email thật rồi mới tìm username |
| Giới hạn tần suất | Chỉ khai báo ThrottlerModule, chưa gắn guard | Bật guard cho các API auth nhạy cảm; `AUTH_RATE_LIMIT` mặc định 10 yêu cầu/IP/endpoint/phút |
| RolesGuard | Vai trò ở controller ghi đè vai trò riêng của handler | Đọc metadata handler trước controller |
| Validation | Nhận `Partial<Entity>` hoặc object inline nên ValidationPipe không bảo vệ được các trường persistence | DTO cụ thể cho body/query, nested validation, giới hạn phân trang/HSK, enum và boolean; loại bỏ trường ngoài hợp đồng |
| ID tài khoản | ID dạng chuỗi dẫn đến so sánh sai với ID số và lỗi database cho input không hợp lệ | `UserIdPipe` chuẩn hóa ID relational và kiểm tra ID MongoDB |
| Tài khoản | Mục tiêu học tập và mã học viên không được lưu đầy đủ; DTO cập nhật lặp lại DTO tạo | Lưu đầy đủ các trường; dùng `PartialType`/`PickType`; sửa mapper document cho các trường đã có trong schema |
| Mã học viên PostgreSQL | `MAX + 1` nằm ngoài transaction, có thể trùng khi tạo/duyệt đồng thời | Cấp mã trong transaction với advisory lock, unique index ở database và kiểm tra tràn integer; tính cả tài khoản đã soft delete |
| Mật khẩu/seed | Mật khẩu chung, mật khẩu admin hardcode và log toàn bộ DTO có password | Dùng `randomBytes` cho mật khẩu phát sinh, xóa log DTO, cấu hình seed/admin qua biến môi trường và đóng connection khi script kết thúc |
| Đổi email | Xác nhận email mới có thể kích hoạt lại tài khoản | Chỉ cập nhật email; giữ trạng thái phê duyệt hiện tại |
| Cache đề thi | Mọi ID dùng chung khóa `exam-details`; ghi dữ liệu không làm mới cache | Bỏ cache tại endpoint chi tiết để đọc đúng ID và dữ liệu mới; đổi cấu hình cache toàn cục sang Keyv Redis tương thích |
| Danh sách câu hỏi | Xóa danh sách cũ rồi ghi mới bên ngoài transaction | Thay thế trong một transaction, khóa bài luyện tập để tránh trộn hai lần cập nhật đồng thời |
| Xóa bài luyện tập | Xóa liên kết rồi xóa bài bằng hai câu lệnh rời | Xóa parent một lần và dùng FK cascade; xử lý 404 nếu parent bị xóa trước khi lấy khóa |
| Schema/migration | Thiếu bảng audit log, topic từ vựng và audio của bài luyện tập/section đề thi | Bổ sung migration; test PostgreSQL đối chiếu bảng/cột của toàn bộ entity với schema tạo bằng migration |
| Lỗi PostgreSQL | Duplicate/FK/input không hợp lệ có thể trả 500 | Filter trả 409/422/400 tương ứng; lỗi không xác định trả 500 và log mã lỗi, giữ SQL/parameters khỏi HTTP response |
| Audit snapshot | `merge` thay đổi entity trước khi lấy snapshot cũ; lỗi ghi log bị nuốt | Chụp dữ liệu trước khi merge; tập trung ghi log bất đồng bộ và ghi nhận lỗi bằng Logger |
| Thống kê | Tổng câu hỏi không theo bộ lọc skill; tổng từ vựng cùng topic bị ghi đè | Áp dụng bộ lọc khi đếm và cộng số lượng giữa các cấp HSK |
| Ngày học | Dùng ngày UTC, sai ngày học ở Việt Nam gần nửa đêm | Dùng `Asia/Ho_Chi_Minh` cho ngày học và ranh giới streak/tuần/tháng |
| Game realtime | Cho khách không có token vào game; lookup socket sai namespace; queue có race và trùng người | Xác thực phiên, kiểm tra trạng thái/HSK, dùng namespace socket, chờ join room, dùng Lua cho queue và theo dõi từng socket của người dùng |
| AI | Trả điểm giả khi thiếu provider/cấu hình; không kiểm tra JSON trả về | Trả 503 khi chưa cấu hình, giới hạn upload audio, timeout Gemini và validation kết quả chấm bài |
| Cấu trúc/chất lượng | `any`, import thừa, dữ liệu topic nằm trong service, dependency peer không tương thích | Chặn explicit `any`, bỏ import thừa, tách catalog topic, sửa class-validator về 0.14.4 tương thích mapped-types, thay adapter Redis cũ |
| Duy trì chất lượng | Chưa có lệnh kiểm tra chung | Thêm `npm run check`, typecheck script admin, quy tắc LF và workflow GitHub Actions tại root |

Cấu hình cache dùng `stores`/Keyv theo [tài liệu NestJS](https://docs.nestjs.com/techniques/caching). Kết quả AI được kiểm tra tại ứng dụng sau khi yêu cầu JSON, phù hợp với giới hạn của [structured output Gemini](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

## Kiểm tra

Chạy tại thư mục `backend`:

```bash
npm ci
npm run check
```

Bộ kiểm tra gồm lint, TypeScript cho ứng dụng và script admin, Jest và build NestJS. Kết quả cuối: **266 file được lint, 0 lỗi/0 cảnh báo; 144 test hồi quy trong 14 suite thành công; typecheck và build thành công**. Thêm **9 test PostgreSQL trong 1 suite thành công**, tổng cộng **153 test**. `git diff --check` không phát hiện lỗi khoảng trắng. Test bao gồm HTTP chạy trong bộ nhớ với service giả lập, phân quyền, phiên JWT, validation, thao tác ghi mục tiêu học tập/mật khẩu/mã học viên, transaction thay câu hỏi, snapshot audit, ngày học, game gateway, rate limit, xác nhận email và kết quả AI.

Dependency Redis/Keyv và class-validator/mapped-types đã được kiểm tra bằng `npm ls`; không còn peer conflict ở các gói đã thay đổi. Workflow được thêm vào repository nhưng chưa chạy trên GitHub.

PostgreSQL và Redis của dự án local không mở cổng, Docker daemon chưa chạy. Đã dùng [embedded-postgres](https://github.com/leinelissen/embedded-postgres) như công cụ tạm để chạy PostgreSQL 17.10 thật trên cổng riêng, với database UTF-8 riêng; **9 test tích hợp PostgreSQL thành công**. Test kiểm tra migration tạo đủ bảng/cột, cấp mã khi tạo/duyệt đồng thời, unique index chống SQL trực tiếp, giữ mã đã xóa, rollback thay câu hỏi, khóa chống trộn danh sách, cascade và ghi audit/topic từ vựng. Database và công cụ tạm được dọn sau kiểm thử.

Có thể chạy lại bằng tài khoản PostgreSQL dành riêng cho test có quyền `CREATEDB`:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://test_user:test_password@127.0.0.1:5432/postgres'
npm.cmd run test:integration
```

Suite tự tạo/xóa database có tên `backend_review_<uuid>`, không chạy migration lên database trong URL. CI đã thêm PostgreSQL service và bước này; workflow chưa chạy trên GitHub. Chưa chạy ứng dụng đầy đủ hoặc Lua matchmaking trên Redis thật. PostgreSQL test hiện có cảnh báo deprecation của driver `pg` khi TypeORM truy vấn metadata; không gây lỗi test.

## Thay đổi cần lưu ý khi tích hợp

- API ghi nội dung cần token của admin/giảng viên hoạt động. Học viên không còn ghi nội dung được.
- Dữ liệu body/query sai trả 422; ID nội dung sai định dạng trả 400. Các trường bắt buộc khi cập nhật không nhận `null`; các trường nullable vẫn xóa được bằng `null`.
- Tài khoản không truyền mật khẩu không dùng mật khẩu mặc định chung. Truyền mật khẩu khi tạo hoặc dùng endpoint cấp mật khẩu tạm thời.
- Seed production cần `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (ít nhất 12 ký tự). Hai biến `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` có thể để trống để bỏ qua tài khoản mẫu. Script `create-admin.ts` luôn yêu cầu cấu hình admin.
- API chấm bài viết cần `GEMINI_API_KEY`; `GEMINI_MODEL` mặc định là `gemini-2.5-flash`. API chấm phát âm chưa có provider và trả 503.
- Ngày học mới được ghi theo múi giờ Việt Nam. Dữ liệu lịch sử đã lưu theo UTC không tự chuyển ngày.
- Cần chạy `npm run migration:run` khi cập nhật database hiện tại. Hai migration mới thêm `emailVerifiedAt`/unique index mã học viên và bổ sung schema nội dung/audit. Migration unique index sẽ dừng nếu có mã trùng; không tự đổi mã học viên. Database đã thêm các cột/bảng này thủ công cần đối chiếu lịch sử migration trước khi áp dụng.
- Đăng ký và social signup giữ trạng thái pending. Xác nhận email cập nhật `emailVerifiedAt`; đăng nhập yêu cầu `status=active`. Link xác nhận cũ không có purpose không còn hợp lệ; gọi `POST /api/v1/auth/email/resend` với `{ "email": "..." }` để nhận link mới. API trả 204 đồng nhất cho email không tồn tại/đã xác nhận/social account.
- DTO profile tự phục vụ dùng cùng validation với DTO tài khoản; trường xác nhận email và quyền hạn chỉ cập nhật qua luồng nội bộ. Đổi email bằng quản trị xóa thời điểm xác nhận cũ.
- Auth rate limit dùng bộ nhớ từng instance; hệ thống nhiều instance cần storage chung. Bộ E2E Docker relational đã thêm Redis và tăng limit trong môi trường test. Chưa chạy bộ E2E Docker.
- Không áp dụng migration/seed lên database dự án, sửa dữ liệu hiện có hay triển khai server. Migration chỉ được thực thi trên database test tạm.

## Phần chưa phải tính năng hoàn chỉnh

Đây là các giới hạn nghiệp vụ/kiến trúc đã có, cần triển khai riêng theo yêu cầu sản phẩm:

- Chấm phát âm chưa tích hợp speech provider; cron reset daily tasks chỉ có placeholder.
- Chưa có controller cho grammar, exam-submissions, flashcards hoặc các endpoint gamification được mô tả trong README cũ. README root đã ghi rõ trạng thái này.
- Thống kê đóng góp theo từng giảng viên chưa có dữ liệu người tạo nội dung; các trường đếm theo giảng viên đang là placeholder.
- Game offline nhận điểm từ client, chưa có cơ chế xác minh kết quả ở server. Game realtime chưa có vòng đời trận đấu và chấm điểm đầy đủ; triển khai nhiều instance cần Socket.IO adapter và cơ chế dọn presence khi process bị dừng đột ngột.
- Các module HSK dùng TypeORM/PostgreSQL; bộ persistence MongoDB của boilerplate chưa đủ để chạy toàn bộ ứng dụng HSK, và không có schema cho tất cả trường giảng viên/mã học viên.

Các giới hạn này cần được phân biệt với việc lint/build/test đã qua; bộ kiểm tra tĩnh không chứng minh hệ thống đã hoàn chỉnh cho production.
