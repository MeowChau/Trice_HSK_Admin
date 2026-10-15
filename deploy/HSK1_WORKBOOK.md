# Thay danh sách câu hỏi trên VPS bằng sách bài tập HSK 1

Gói cập nhật được tạo từ `Workbook Hsk 1 练习册  HSK-1.pdf`: 139 trang scan của **新HSK教程1 学练手册 / New HSK Course 1 Workbook**. Mỗi mục giữ ảnh đề gốc, số bài, câu và **trang PDF** để đối chiếu. Ảnh gốc là nội dung chính; OCR chỉ hỗ trợ tìm vị trí, chưa được xác nhận là bản chép chính xác.

## Dữ liệu được nhập

| Nhóm | Số mục | Trạng thái ban đầu |
| --- | ---: | --- |
| Câu nghe luyện thi | 140 | Chờ audio và đáp án do bạn cung cấp |
| Câu đọc luyện thi | 140 | Có đáp án do đối chiếu câu gốc |
| Bài luyện nghe/phát âm theo audio | 63 | Chờ audio, tiêu chí chấm và đối chiếu |
| Bài luyện viết/tập nét | 21 | Có ảnh mẫu, chờ tiêu chí chấm |
| Bài đọc chọn lời thoại theo nhóm hình | 3 | Có đề gốc, chờ đáp án/tiêu chí cho từng mục nhỏ |
| **Tổng** | **367** | **280 câu luyện thi + 87 bài luyện** |

Bài 1–3 là luyện âm; phần luyện viết chữ bắt đầu từ bài 8. Bài 4–15 mỗi bài có 20 câu luyện thi; đề mô phỏng cuối sách có 40 câu. Có 805 ảnh WebP, khoảng 9,5 MB. Không tạo câu hỏi từ tiêu đề/lý thuyết. Một bài luyện có nhiều ô/âm/nhân vật được giữ thành một bài nguyên vẹn. Đã ghép phần luyện viết tiếp từ trang PDF 110 sang 111 và phần nghe từ trang 118 sang 119.

**PDF không kèm đáp án hay audio.** 140 đáp án đọc được suy ra từ câu và phương án trong bản scan, có `answerProvenance=derived-from-original-question`; không giả làm đáp án của nhà xuất bản. Phần nghe không được gán đáp án ngẫu nhiên. Tất cả 203 mục cần nghe đều chờ bạn tải audio. Có thể mở `backend/workbook-hsk1/release/review.html` trên Windows để xem từng ảnh trước khi nhập.

## Cập nhật VPS

Trên **PowerShell máy Windows**:

```powershell
cd D:\trice_hsk
powershell -ExecutionPolicy Bypass -File .\deploy\package-hsk1-workbook.ps1
scp .\tricehsk-hsk1-rebuild.tar.gz user@100.104.108.58:/home/user/
ssh user@100.104.108.58
```

Sau khi thấy prompt **`user@BanChau9th10`**, chạy trên **VPS**:

```bash
cd /home/user/trice_hsk/deploy
tar -xzf /home/user/tricehsk-hsk1-rebuild.tar.gz -C .
bash rebuild-hsk1-workbook.sh --tunnel
```

Script kiểm tra checksum toàn bộ ảnh bằng image API đang chạy trước khi sửa source hoặc build. Sau đó build API/admin trước khi thay dữ liệu. Trên VPS 1 CPU, bước build có thể mất vài phút. Không đóng terminal lúc đang chạy script. Cần thấy cả `HSK1_QUESTION_BANK_REBUILT`, `WORKBOOK_DATABASE_VERIFIED: 367` và `HSK1_WORKBOOK_UPDATE_OK`. Sau đó tải lại trang **Danh sách câu hỏi**.

### Lỗi checksum ảnh sau giải nén

Nếu gói gốc có SHA256 `3b678a2f148a3fcf08a82c654b93401eacd2cf335ed45aaa3a1450567d5ced8e` nhưng ảnh đã giải nén không khớp, dùng gói sửa riêng `tricehsk-hsk1-checksum-fix.tar.gz`. Gói này giữ nguyên gói sách đã xác thực và không yêu cầu upload lại 9,7 MB dữ liệu.

Trên PowerShell Windows:

```powershell
scp "D:\trice_hsk\tricehsk-hsk1-checksum-fix.tar.gz" user@100.104.108.58:/home/user/
```

Trên VPS:

```bash
cd /home/user/trice_hsk/deploy
tar -xzf /home/user/tricehsk-hsk1-checksum-fix.tar.gz -C .
bash repair-workbook-checksum.sh --tunnel
```

Script xác thực SHA256 của gói gốc, giải nén vào thư mục mới, kiểm tra 805 ảnh bằng Node trong container tạm không có kết nối mạng hoặc truy cập DB. Container kiểm tra/bảo trì dùng UID 0 để đọc file giải nén dù UID trên VPS khác UID của image. Chỉ ảnh sách đã xác thực được đặt quyền 0644 để API đọc; JSON backup vẫn 0600 và được trả quyền sở hữu cho chủ `.env`. Không đổi quyền `.env`, upload khác hay thư mục backup. Chỉ sau khi kiểm tra xong mới giữ thư mục cũ ở `workbook-hsk1-before-checksum-...`, cài thư mục mới và tiếp tục cập nhật bình thường. Nếu kiểm tra ảnh thất bại, source, DB và thư mục đang dùng được giữ nguyên. Script không bỏ qua checksum.

Script thay **toàn bộ câu hỏi**, kể cả câu hỏi đã xóa mềm. Tài khoản, mật khẩu, từ vựng, file cũ, đề thi và bộ luyện tập được giữ. **Liên kết từ đề thi/bộ luyện tập tới câu hỏi cũ bị gỡ; cần chọn lại câu hỏi mới**. Không tự gán câu mới vào đề cũ vì nội dung/đáp án có thể khác.

Trước khi thay, script sao lưu **database đang được API dùng** (kể cả database đã nhập từ localhost), upload volume đang dùng, `.env`, ảnh Docker và các file source bị sửa vào `deploy/backups/hsk1-workbook-...`. `questions-before.json` chứa toàn bộ câu hỏi cũ và liên kết; `questions-imported.json` là kết quả import thành công. Không in mật khẩu ra màn hình. Nên chép thư mục backup về máy riêng; không công khai các file backup.

Import chạy trong một transaction, có kiểm tra checksum từng ảnh, đếm mục, kiểm tra khóa ngoại và giữ nguyên số bản ghi liên quan. Nếu DB thay đổi sau khi backup hoặc lỗi chèn dữ liệu, transaction hoàn tác. File ảnh sách đã chép có thể còn trong upload volume khi transaction thất bại; không xóa file khác để dọn chúng. Nếu script báo lỗi, gửi dòng lỗi; đừng chạy lại hay khôi phục toàn bộ DB khi chưa xác định transaction đã commit hay chưa.

Nếu CI/CD đã được kích hoạt (`deploy/.ci/active-images.env`), script dừng trước khi build/thay dữ liệu: cần phát hành thay đổi source qua workflow đang dùng rồi thực hiện import bằng ảnh đang được CI quản lý.

## Thêm và sửa câu hỏi

**Danh sách câu hỏi → Thêm câu hỏi**: chọn kỹ năng rồi dạng bài. Có 17 khung cho nghe chọn hình/chọn câu/ghép hình/đúng sai/nghe viết/đọc theo, đọc ghép hình/ghép câu/điền từ/chọn đáp án/đúng sai/điền tự do/chọn lời thoại theo nhóm hình, viết theo mẫu/trả lời ngắn/tự luận và đọc thành tiếng.

Ảnh chứa sẵn phương án A/B/C chỉ cần tải ảnh, chọn số phương án và đáp án. Có thể thêm ảnh/nội dung riêng cho mỗi phương án. Câu ghép hoặc điền từ dùng ảnh/ngân hàng phương án chung. Bản xem trước giữ ảnh đúng tỷ lệ. Câu chưa có đáp án có thể lưu nháp, không tự chọn A hay tự tạo phương án. Bài viết/đọc thành tiếng dùng tiêu chí chấm do người biên soạn điền.

Trong danh sách, lọc **Bài trong sách HSK 1** hoặc **Trạng thái biên soạn** để tìm bài chờ audio, chờ đáp án/tiêu chí hay cần đối chiếu. Bấm **Sửa/Gắn audio** để sửa câu hiện có, không phải tạo lại.

## Audio do bạn tự tải

1. Mở **Gắn audio** ở câu nghe.
2. Tải một file cho câu đó, hoặc tải file cả bài. Hỗ trợ MP3/WAV/M4A/OGG/AAC/FLAC/WebM, tối đa 90 MB trên form.
3. Với file chung, chép đường dẫn file vừa tải sang các câu khác ở **Dùng đường dẫn file có sẵn**. Không cần upload lại cùng file.
4. Điền mốc bắt đầu/kết thúc **theo giây**, ví dụ `15.5`–`29.8`; nghe thử ngay trên form. Để trống mốc nếu file riêng chỉ chứa câu đó.
5. Nghe, chọn đáp án đúng (hoặc tiêu chí cho nghe viết/đọc theo), đánh dấu đã đối chiếu rồi lưu.

Form kiểm tra mốc âm/NaN, kết thúc trước bắt đầu và vượt độ dài file. Player xem trước/danh sách phát đúng đoạn đã chọn. Phiên bản này quản lý audio và mốc phát; không tự tách hay tạo lời đọc từ sách.

## Khôi phục riêng ngân hàng câu hỏi

Giữ `questions-before.json` và database dump. Nếu muốn hoàn tác ngay và ngân hàng chưa được sửa sau import, chạy trên VPS (thay `TIMESTAMP` bằng đúng thư mục được script báo):

```bash
cd /home/user/trice_hsk/deploy
bash restore-hsk1-questions.sh backups/hsk1-workbook-TIMESTAMP --tunnel
```

Khôi phục riêng câu hỏi/liên kết trong transaction, giữ tài khoản, từ vựng và upload. Nếu có sửa/thêm dữ liệu sau import, script từ chối hoàn tác tự động để không ghi đè thay đổi; cần đối chiếu trước. Database dump là phương án khôi phục đầy đủ, sẽ ảnh hưởng dữ liệu tạo mới sau thời điểm backup nên không dùng tự động. Mật khẩu admin không bị reset bởi cập nhật này.

## Kiểm tra trong workspace

```powershell
cd D:\trice_hsk\backend
npm.cmd run check
cd ..\fe_admin\dashboard
npm.cmd run test:questions
npm.cmd run test:media
npm.cmd run build
```

Test tích hợp `deploy/tests/workbook-import.test.cjs` tạo database `workbook_test_<uuid>` riêng từ `TEST_DATABASE_URL`, chạy migrations, thử lỗi chèn/concurrent edit và thay câu hỏi thật; tự xóa đúng database do test tạo. Không chạy import vào database localhost vì mục tiêu được chọn là VPS.
