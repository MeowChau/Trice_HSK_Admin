"""Extract faithful question images and structured types from the supplied scan.

OCR helps locate items; the original scan remains the authoritative content.
The PDF has no answer key or audio, so none is invented by this extractor.
"""
import hashlib
import io
import json
import re
from pathlib import Path
from statistics import median

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / "backend/workbook-hsk1"
OUT = WORK / "release"
ASSETS = OUT / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
PDF = next(Path("D:/").glob("Workbook Hsk 1 *.pdf"))
SOURCE_SHA = hashlib.file_digest(PDF.open("rb"), "sha256").hexdigest()
VERSION = SOURCE_SHA[:12]
DOC = pymupdf.open(PDF)
BOOK = "新HSK教程1 学练手册 / New HSK Course 1 Workbook"
LESSONS = ["AI小语，你好！", "我叫李文", "我是中国人", "我有两个孩子", "今天我休息", "你的手机号是多少？",
           "我晚上六点半下班", "我爸爸也在医院工作", "我明天上午在学校学习", "这儿的苹果真便宜！",
           "我读大学呢", "昨天下雪了", "请给我一杯茶", "我看了一个电影", "大兴机场见！"]
STARTS = [8, 12, 16, 20, 29, 38, 46, 55, 64, 73, 82, 91, 100, 109, 118]
PRACTICE_STARTS = {4: 23, 5: 32, 6: 40, 7: 49, 8: 58, 9: 67, 10: 76, 11: 85, 12: 94, 13: 103, 14: 112, 15: 121}
CACHE = {n: json.loads((WORK / "ocr" / f"page-{n:03}.json").read_text(encoding="utf-8")) for n in range(8, 138)}
QUESTIONS = []
CROPS = {}
NOTES = []
LAST_ASSET_PAGE = None


def clip(page, bbox, key):
    global LAST_ASSET_PAGE
    if LAST_ASSET_PAGE != page:
        # Scanned source pages decompress to much more than the output crops.
        # Release the previous page's image cache before decoding another one.
        pymupdf.TOOLS.store_shrink(100)
        LAST_ASSET_PAGE = page
    rect = pymupdf.Rect(bbox) & DOC[page - 1].rect
    if rect.width < 5 or rect.height < 5:
        raise ValueError(f"Invalid question crop: {page} {bbox}")
    name = f"hsk1-workbook-{VERSION}-p{page:03}-{key}.webp"
    target = ASSETS / name
    pix = DOC[page - 1].get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=rect)
    with Image.frombytes('RGB', (pix.width, pix.height), pix.samples) as crop:
        crop.save(target, "WEBP", quality=92)
    CROPS[name] = {"pdfPage": page, "bbox": list(rect)}
    return f"/api/v1/files/{name}"


def groups(page, count, min_y=100, minimum_letters=2, max_y=800, prefix_labels=False):
    rows = []
    for w in sorted(CACHE[page]["words"], key=lambda x: x[1]):
        label = w[4]
        if prefix_labels and label and label[0] in "ABC" and (len(label)==1 or not label[1].islower()):
            w = [*w[:4], label[0], *w[5:]]
        if w[4] not in ("A", "B", "C") or not 110 < w[0] < 535 or not min_y <= w[1] <= max_y:
            continue
        if not rows or w[1] - median(x[1] for x in rows[-1]) > 7:
            rows.append([w])
        else:
            rows[-1].append(w)
    rows = [row for row in rows if len({w[4] for w in row}) >= minimum_letters]
    if len(rows) < count:
        raise ValueError(f"Cannot find {count} option rows on PDF page {page}: {len(rows)}")
    return rows[-count:]


def numbered_rows(page, numbers, fallback=None):
    anchors = {}
    for w in CACHE[page]["words"]:
        token = w[4].strip(".,，。 ").replace("l", "1").replace("I", "1")
        if 40 < w[0] < 130 and w[1] > 55 and token.isdigit() and int(token) in numbers:
            anchors.setdefault(int(token), []).append(w[1])
    found = {n: max(anchors[n]) for n in numbers if n in anchors}
    if len(found) == len(numbers):
        return [found[n] for n in numbers]
    if len(found) >= 2:
        first, last = min(found), max(found)
        step = (found[last] - found[first]) / (last - first)
        result = [found.get(n, found[first] + (n - first) * step) for n in numbers]
    elif fallback:
        result = fallback
    else:
        raise ValueError(f"Missing item coordinates on PDF page {page}: {numbers}, found={found}")
    NOTES.append({"pdfPage": page, "items": numbers, "note": "OCR missed an item number; positions inferred from the original section layout.", "positions": result})
    return result


def add(lesson, number, skill, kind, template, page, bbox, options=(), option_images=(), context=None, section="simulated-practice", manual=False):
    item_key = f"l{lesson:02}-q{number:02}" if isinstance(number, int) else f"l{lesson:02}-{number}"
    scan = clip(page, bbox, item_key)
    instruction = {
        "listen-image-choice": "Nghe audio và chọn hình phù hợp.",
        "listen-text-choice": "Nghe audio và chọn câu trả lời đúng.",
        "listen-image-matching": "Nghe hội thoại và chọn hình phù hợp trong ngân hàng hình.",
        "read-image-matching": "Đọc câu trong đề gốc và chọn hình phù hợp.",
        "read-sentence-matching": "Ghép câu hỏi với câu trả lời phù hợp.",
        "read-word-bank": "Chọn từ phù hợp để điền vào chỗ trống.",
        "read-text-choice": "Đọc đoạn văn và chọn đáp án đúng.",
        "listen-repeat": "Nghe và đọc lại theo yêu cầu trong ảnh đề gốc.",
        "listen-dictation": "Nghe audio và viết lại nội dung theo đề gốc.",
        "write-tracing": "Luyện viết theo mẫu trong ảnh đề gốc.",
        "read-aloud": "Đọc thành tiếng theo yêu cầu trong ảnh đề gốc.",
        "read-guided-practice": "Đọc và chọn lời thoại phù hợp với từng hình trong đề gốc.",
    }[template]
    title = f"Bài {lesson}: {LESSONS[lesson-1]}" if lesson else "Đề mô phỏng HSK 1"
    raw_lines = []
    for block in CACHE[page]["blocks"]:
        for line in block.get("lines", []):
            if bbox[1] <= line["bbox"][1] <= bbox[3]:
                raw_lines.append("".join(span["text"] for span in line["spans"]))
    source = {"book": BOOK, "bookId": f"hsk1-workbook-{VERSION}", "pdfSha256": SOURCE_SHA,
              "pdfPage": page, "lesson": lesson, "lessonTitle": title, "section": section,
              "item": number, "bbox": list(bbox), "scanUrl": scan,
              "ocrText": "\n".join(raw_lines), "ocrVerified": False, "answerKeyProvided": False}
    item_label = f'Câu {number}' if isinstance(number, int) else f'Bài luyện {int(number.rsplit("-", 1)[-1])}'
    payload = {"schemaVersion": 1, "templateId": template, "text": f"{title} · {item_label}. {instruction}",
               "imageUrl": scan, "source": source, "reviewRequired": True, "manualGrading": manual}
    if options:
        payload["options"] = list(options)
        payload["optionImages"] = list(option_images)
    if context:
        payload["contextImageUrl"] = context
    if skill == "LISTENING":
        payload["audioGroup"] = f"hsk1-workbook-l{lesson:02}-{section}"
        payload["audioStatus"] = "awaiting-upload"
    QUESTIONS.append({"type": kind, "skill": skill, "difficulty": 1, "hskLevel": 1,
                      "payload": payload, "correctAnswer": None, "isGameQuestion": False})


def mc_image(lesson, page, numbers):
    min_y = 350 if lesson else 250 if page == 128 else 70
    selected = groups(page, len(numbers), min_y=min_y, minimum_letters=1)
    ys = [median(w[1] for w in row) for row in selected]
    row_height = median(ys[i+1] - ys[i] for i in range(len(ys)-1)) if len(ys) > 1 else 110
    image = Image.open(io.BytesIO(DOC[page-1].get_pixmap().tobytes("png"))).convert("L")
    def border_near(y):
        candidates = range(max(45, int(y)-12), min(800, int(y)+30))
        return max(candidates, key=lambda line: sum(pixel < 220 for pixel in image.crop((50, line, 545, line+1)).getdata()))
    bottoms = [border_near(y+12) for y in ys]
    first_top = border_near(bottoms[0]-row_height-12)
    # Tesseract's GlyphLessFont sometimes expands a one-letter word's x2 over
    # an entire row; only the left coordinate is reliable for option labels.
    a = median(w[0]+4 for row in selected for w in row if w[4] == "A")
    b = median(w[0]+4 for row in selected for w in row if w[4] == "B") if any(w[4] == "B" for row in selected for w in row) else a+132
    step = b-a
    for number, row, y in zip(numbers, selected, ys):
        index = numbers.index(number)
        top = first_top if index == 0 else bottoms[index-1]
        bottom = bottoms[index]
        images = [clip(page, (a + i*step-step/2, top, a+i*step+step/2, bottom), f"l{lesson:02}-q{number:02}-opt{chr(65+i)}") for i in range(3)]
        add(lesson, number, "LISTENING", "MULTIPLE_CHOICE", "listen-image-choice", page,
            (50, top, 545, bottom), ["", "", ""], images, section="mock-test" if not lesson else "simulated-practice")


def mc_text(lesson, page, numbers, skill):
    if lesson and numbers == [4, 5]:
        selected = groups(page, 2, min_y=300, max_y=420, minimum_letters=1, prefix_labels=True)
    else:
        minimum = 400 if lesson and numbers == [9, 10] else 280 if not lesson and numbers[0] == 16 else 230
        selected = groups(page, len(numbers), min_y=minimum, minimum_letters=2, prefix_labels=True)
    ys = [median(w[1] for w in row) for row in selected]
    ids = numbered_rows(page, numbers, [y-50 if skill == "READING" else y for y in ys])
    for i, (number, row, y, ident) in enumerate(zip(numbers, selected, ys, ids)):
        top = min(ident - 20, y - 35)
        bottom = min(y + 23, ids[i+1]-20) if i+1 < len(ids) else y+23
        images = [clip(page, (110+j*135, y-35, 245+j*135, y+23), f"l{lesson:02}-q{number:02}-opt{chr(65+j)}") for j in range(3)]
        add(lesson, number, skill, "MULTIPLE_CHOICE", "listen-text-choice" if skill == "LISTENING" else "read-text-choice",
            page, (50, top, 545, bottom), ["", "", ""], images, section="mock-test" if not lesson else "simulated-practice")


def match_items(lesson, page, numbers, skill, context, letters="ABCD", template=None, fallback=None, next_boundary=None):
    ys = numbered_rows(page, numbers, fallback)
    step = median(ys[i+1]-ys[i] for i in range(len(ys)-1)) if len(ys)>1 else 50
    for i, (number, y) in enumerate(zip(numbers, ys)):
        bottom = ys[i+1]-22 if i+1<len(ys) else y+max(24, step-22)
        if next_boundary is not None:
            bottom = min(bottom, next_boundary)
        top = y - (10 if skill == 'LISTENING' else 22)
        if skill == 'LISTENING':
            bottom = y + 20
        add(lesson, number, skill, "MATCHING", template or ("listen-image-matching" if skill == "LISTENING" else "read-image-matching"),
            page, (50, top, 545, bottom), list(letters), context=context,
            section="mock-test" if not lesson else "simulated-practice")


def fill_items(lesson, page, numbers, context, fallback=None, boundary=None):
    ys = numbered_rows(page, numbers, fallback)
    step = median(ys[i+1]-ys[i] for i in range(len(ys)-1)) if len(ys)>1 else 65
    for i, (number, y) in enumerate(zip(numbers, ys)):
        bottom = ys[i+1]-22 if i+1<len(ys) else y+max(45, step-22)
        if boundary:
            bottom = min(bottom, boundary)
        add(lesson, number, "READING", "FILL_IN_BLANK", "read-word-bank", page,
            (50, y-24, 545, bottom), list("ABCDEF" if not lesson else "ABC"), context=context,
            section="mock-test" if not lesson else "simulated-practice")


for lesson, start in PRACTICE_STARTS.items():
    mc_image(lesson, start, [1, 2, 3])
    mc_text(lesson, start+1, [4, 5], "LISTENING")
    context = clip(start+1, (55, 510, 540, 790), f"l{lesson:02}-listen-bank")
    match_items(lesson, start+2, [6, 7, 8], "LISTENING", context, "ABCD", fallback=[190, 223, 257], next_boundary=310)
    mc_text(lesson, start+2, [9, 10], "LISTENING")
    context = clip(start+3, (60, 195, 540, 435), f"l{lesson:02}-read-picture-bank")
    match_items(lesson, start+3, [11, 12, 13], "READING", context, fallback=[480, 525, 570], next_boundary=610)
    early_bank = "Questions 14" in CACHE[start+3]["text"]
    bank_page = start+3 if early_bank else start+4
    sentence_bank = clip(bank_page, (105, 700 if early_bank else 155, 535, 798 if early_bank else 250), f"l{lesson:02}-read-sentence-bank")
    match_items(lesson, start+4, [14, 15, 16], "READING", sentence_bank, template="read-sentence-matching",
                fallback=[150, 195, 240] if early_bank else [345, 390, 430], next_boundary=470 if not early_bank else 290)
    fill_page = start+4
    option_row = groups(fill_page, 1)[0]
    word_y = median(w[1] for w in option_row)
    word_bank = clip(fill_page, (105, word_y-27, 535, word_y+24), f"l{lesson:02}-read-word-bank")
    if early_bank:
        fill_items(lesson, fill_page, [17, 18], word_bank, fallback=[520, 565], boundary=730)
    else:
        fill_items(lesson, fill_page, [17], word_bank, fallback=[710], boundary=795)
        fill_items(lesson, start+5, [18], word_bank, fallback=[85], boundary=165)
    mc_text(lesson, start+5, [19, 20], "READING")

mc_image(0, 128, [1, 2, 3])
mc_image(0, 129, [4, 5])
mc_text(0, 130, [6, 7, 8, 9, 10], "LISTENING")
listen_bank = clip(131, (60, 145, 545, 470), "mock-listen-bank")
match_items(0, 131, [11, 12, 13, 14, 15], "LISTENING", listen_bank, "ABCDEF")
mc_text(0, 132, [16, 17, 18, 19, 20], "LISTENING")
read_bank = clip(134, (65, 145, 545, 545), "mock-read-picture-bank")
match_items(0, 134, [21, 22, 23, 24, 25], "READING", read_bank, "ABCDEF")
sentence_bank = clip(135, (375, 110, 550, 555), "mock-read-sentence-bank")
match_items(0, 135, [26, 27, 28, 29, 30], "READING", sentence_bank, "ABCDEF", "read-sentence-matching", fallback=[230, 300, 370, 440, 510])
word_bank = clip(136, (110, 125, 535, 190), "mock-word-bank")
fill_items(0, 136, [31, 32, 33, 34, 35], word_bank)
mc_text(0, 137, [36, 37, 38, 39, 40], "READING")
assert len(QUESTIONS) == 280, f"Expected 240 lesson practice items + 40 mock test items, got {len(QUESTIONS)}"

# Extract guided exercises, not the theory paragraphs. The image retains grids,
# character tracing sheets, and tone marks that cannot safely be reconstructed.
for lesson, start in enumerate(STARTS, 1):
    end = PRACTICE_STARTS.get(lesson, STARTS[lesson] if lesson < 15 else 127)
    counter = 0
    for page in range(start, end):
        lines = []
        for block in CACHE[page]["blocks"]:
            for line in block.get("lines", []):
                text = "".join(span["text"] for span in line["spans"])
                lines.append((line["bbox"][1], line["bbox"][3], text))
        lines.sort()
        prompts = [(y, bottom, text) for y, bottom, text in lines
                   if re.search(r"(?:^Listen(?:,| and|\s)|^Look at the pictures|Stroke(?: Order)? Practice|Character and Word Writing|Compound Character (?:Structure|and Radical) Practice)", text.strip(), re.I)
                   and not re.search(r'Listen,?\s*Read,?\s*and\s*Practice', text, re.I)]
        theory = [(y, text) for y, _, text in lines if len(text) < 100 and not re.match(r'^(Listen|Look)', text.strip(), re.I)
                  and re.search(r'\b(?:Spelling Rules|Neutral Tone|Tone Distinction|Chinese Characters|Tones|Sentence Intonation (?:Modulation|Identification))\b', text, re.I)]
        for i, (y, bottom, text) in enumerate(prompts):
            counter += 1
            next_y = prompts[i+1][0]-22 if i+1<len(prompts) else 790
            boundaries = [heading_y - 15 for heading_y, _ in theory if heading_y > bottom + 18]
            if boundaries:
                next_y = min(next_y, min(boundaries))
            if next_y <= y+18:
                continue
            writing = bool(re.search(r"Tracing|Writing|Stroke|Compound Character", text))
            dictation = bool(re.search(r"write down|mark the tones", text, re.I))
            dialogue = 'choose the correct dialogue' in text.lower()
            skill = "WRITING" if writing else "READING" if dialogue else "LISTENING" if 'listen' in text.lower() else "SPEAKING"
            template = "write-tracing" if writing else "read-guided-practice" if dialogue else "listen-dictation" if dictation else "listen-repeat" if skill == "LISTENING" else "read-aloud"
            add(lesson, f"practice-{counter:02}", skill, "SHORT_ANSWER", template, page,
                (55, max(55, y-25), 545, next_y), section="guided-practice", manual=True)
            if page == 118 and 'sentence type' in text.lower():
                QUESTIONS[-1]['payload']['continuationImageUrl'] = clip(119, (60, 55, 540, 215), f'l{lesson:02}-practice-{counter:02}-continued')
                QUESTIONS[-1]['payload']['source']['continuedOnPdfPages'] = [119]
            if page == 110 and writing:
                QUESTIONS[-1]['payload']['continuationImageUrl'] = clip(111, (60, 55, 540, 340), f'l{lesson:02}-practice-{counter:02}-continued')
                QUESTIONS[-1]['payload']['source']['continuedOnPdfPages'] = [111]

# The scan does not provide an answer key. Reading keys were separately derived
# by inspecting the original Chinese question and options, never the raw OCR.
keys = json.loads((WORK / 'reading-answers.json').read_text(encoding='utf-8'))
answered = 0
for question in QUESTIONS:
    source = question['payload']['source']
    if question['skill'] == 'READING' and isinstance(source['item'], int):
        lesson, number = source['lesson'], source['item']
        key = keys['lessons'][str(lesson)] if lesson else keys['mock']
        assert len(key) == (10 if lesson else 20)
        answer = key[number - (11 if lesson else 21)]
        assert answer in question['payload']['options'] or answer in 'ABC'
        question['correctAnswer'] = {'answer': answer}
        source['answerProvenance'] = 'derived-from-original-question'
        question['payload']['reviewRequired'] = False
        answered += 1
assert answered == 140

assets = []
for name, metadata in sorted(CROPS.items()):
    content = ASSETS / name
    assets.append({"name": name, "sha256": hashlib.file_digest(content.open("rb"), "sha256").hexdigest(),
                   "size": content.stat().st_size, **metadata})
data = {"formatVersion": 1, "book": BOOK, "sourcePdfSha256": SOURCE_SHA, "sourcePdfPages": len(DOC),
        "answerKeyIncluded": False, "audioIncluded": False, "coreQuestions": 280,
        "questions": QUESTIONS, "assets": assets, "extractionNotes": NOTES}
(OUT / "questions.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"questions": len(QUESTIONS), "coreQuestions": 280, "guidedExercises": len(QUESTIONS)-280,
                  "assets": len(assets), "assetBytes": sum(a["size"] for a in assets), "inferredCoordinates": len(NOTES)}, ensure_ascii=False))
