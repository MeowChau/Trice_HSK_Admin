"""Build an offline review catalogue and visual crop proof sheets."""
import html
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'backend/workbook-hsk1/release'
data = json.loads((OUT / 'questions.json').read_text(encoding='utf-8'))
cards = []
for q in data['questions']:
    p, s = q['payload'], q['payload']['source']
    urls = [p.get('contextImageUrl'), p['imageUrl'], p.get('continuationImageUrl'), *p.get('optionImages', [])]
    images = ''.join(f'<img loading="lazy" src="assets/{html.escape(url.rsplit("/", 1)[-1])}" alt="Ảnh đề gốc">' for url in urls if url)
    answer = (q.get('correctAnswer') or {}).get('answer', 'Chờ audio/đáp án hoặc tiêu chí chấm')
    cards.append(f'<article data-lesson="{s["lesson"]}"><h2>{html.escape(s["lessonTitle"])} · {s["item"]}</h2><p>{q["skill"]} · {p["templateId"]} · Trang PDF {s["pdfPage"]}</p>{images}<p>Đáp án: {answer}</p></article>')
page = '''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Đối chiếu sách bài tập HSK 1</title><style>body{font-family:system-ui;background:#f5f6fa;max-width:1100px;margin:24px auto;padding:16px}article{background:white;border-radius:16px;padding:24px;margin:20px 0;break-inside:avoid}img{max-width:100%;display:block;margin:8px 0}h2{font-size:18px}select{padding:12px}header{position:sticky;top:0;background:#f5f6fa;padding:10px}</style><header><h1>Đối chiếu sách bài tập HSK 1</h1><p>367 mục: 280 câu luyện thi và 87 bài luyện. 140 đáp án đọc do đối chiếu câu gốc, không phải đáp án kèm sách. PDF không chứa audio hoặc đáp án phần nghe. OCR chưa được xác nhận; ảnh sách là nội dung gốc.</p><select aria-label="Lọc bài" onchange="document.querySelectorAll('article').forEach(e=>e.hidden=this.value!=='all'&&e.dataset.lesson!==this.value)"><option value="all">Tất cả bài</option><option value="0">Đề mô phỏng</option>'''
page += ''.join(f'<option value="{n}">Bài {n}</option>' for n in range(1, 16)) + '</select></header>' + ''.join(cards) + '</html>'
(OUT / 'review.html').write_text(page, encoding='utf-8')
for lesson in range(16):
    items = [q for q in data['questions'] if q['payload']['source']['lesson'] == lesson and q['payload']['source']['section'] != 'guided-practice']
    if not items:
        continue
    # Each column shows a question and its option images, preserving aspect.
    canvas = Image.new('RGB', (1200, ((len(items)+3)//4)*270), 'white')
    pen = ImageDraw.Draw(canvas)
    for i, q in enumerate(items):
        p = q['payload']
        x, y = (i%4)*300, (i//4)*270
        pen.text((x+4, y+4), f'PDF {p["source"]["pdfPage"]} Q{p["source"]["item"]}', fill='black')
        stem = Image.open(OUT/'assets'/p['imageUrl'].rsplit('/', 1)[-1])
        stem.thumbnail((290, 165))
        canvas.paste(stem, (x+4, y+24))
        for j, url in enumerate(p.get('optionImages', [])):
            opt = Image.open(OUT/'assets'/url.rsplit('/', 1)[-1])
            opt.thumbnail((94, 70))
            canvas.paste(opt, (x+3+j*98, y+194))
    canvas.save(OUT/f'review-{lesson:02}.jpg', quality=88)
print('REVIEW_CATALOGUE_OK')
