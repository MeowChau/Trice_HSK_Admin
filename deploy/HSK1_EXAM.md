# Đề mẫu HSK 1 cuối sách

Gói này thay **một đề HSK 1 đã có trên VPS**, giữ mã đề. Không xóa câu hỏi,
tài khoản, từ vựng, bộ luyện tập hoặc đề HSK khác. Nếu 40 câu mẫu đã có trong
ngân hàng, dùng lại mã câu và giữ audio/đáp án admin đã bổ sung. Nếu chưa có,
chỉ thêm 40 câu mẫu và các ảnh liên quan, không thay toàn bộ ngân hàng.

Nguồn: `新HSK教程1 学练手册`, PDF 139 trang đã cung cấp. 40 câu ở trang
128–137: 1–20 nghe, 21–40 đọc. Đáp án 20 câu đọc được đối chiếu từ đề gốc;
file scan không kèm đáp án chính thức. Không có audio hoặc đáp án phần nghe.

## Cài trên VPS

Windows PowerShell:

```powershell
scp "D:\trice_hsk\tricehsk-hsk1-exam.tar.gz" user@100.104.108.58:/home/user/
ssh user@100.104.108.58
```

Sau khi prompt chuyển sang `user@BanChau9th10`, chạy:

```bash
cd /home/user/trice_hsk/deploy
tar -xzf /home/user/tricehsk-hsk1-exam.tar.gz -C .
bash replace-hsk1-exam.sh --tunnel
```

Nếu có nhiều đề HSK 1, script dừng trước khi thay đề và liệt kê các mã đề.
Chạy lại với `--exam-id NUMBER` để chọn đúng đề. Không tự lấy đề đầu tiên.
Nếu CI/CD đã được bật, script dừng để tránh ghi đè nguồn deploy tự động.

Script kiểm tra hash ảnh/nguồn trước khi build, lưu nguồn và image cũ,
backup database đang được API dùng (có thể khác POSTGRES_DB), backup uploads,
lưu cấu trúc đề trước khi thay. Backup nằm trong `backups/hsk1-exam-*`;
chứa dữ liệu riêng tư, không chia sẻ hoặc đưa lên Git.
Thay đề bằng transaction: nếu lỗi SQL, cấu trúc đề cũ vẫn nguyên vẹn.
Nếu lỗi sau khi commit, giữ code tương thích và backup để kiểm tra, không
restore toàn bộ DB tự động hoặc xóa dữ liệu nhập sau đó.

## Xem và chỉnh sửa

Vào **Danh sách đề thi → Sửa**. Xem được ảnh gốc, ngân hàng hình, lựa chọn
và đáp án. Có thể đổi tên/mô tả, sắp xếp phần/câu, thêm/bỏ câu và tải audio
chung cho phần nghe. Bấm **Lưu đề** để lưu cấu trúc trong một transaction.
Nếu người khác đã sửa, máy chủ trả 409 và yêu cầu tải lại thay vì ghi đè.

Để đặt đáp án hoặc đoạn nghe riêng, bấm **Sửa câu hỏi / đáp án / audio**.
Sửa câu hỏi có hiệu lực ngay trên mọi đề/bộ luyện tập dùng chung câu đó.
Sau khi sửa ở tab khác, tải lại trang đề để xem nội dung mới; lưu cấu trúc
đề không ghi đè nội dung câu hỏi.

Theo yêu cầu mới nhất, chưa xây dựng giao diện thí sinh. API xem đề
`GET /api/v1/exams/:id` công khai không trả đáp án/transcript/OCR nguồn.
`GET /api/v1/exams/:id/editor` và `PUT /api/v1/exams/:id` yêu cầu tài khoản
admin/giảng viên đang hoạt động; thí sinh không có quyền sửa. API làm bài,
lưu lượt thi và chấm điểm sẽ được làm cùng giao diện thí sinh sau.
