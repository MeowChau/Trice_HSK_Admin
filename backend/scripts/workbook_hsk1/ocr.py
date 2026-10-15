"""Read the supplied scan locally, caching OCR text and coordinates for review."""
import argparse
import json
import time
from pathlib import Path

import pymupdf

parser = argparse.ArgumentParser()
parser.add_argument("--start", type=int, default=8)
parser.add_argument("--end", type=int, default=137)
args = parser.parse_args()
workspace = Path(__file__).resolve().parents[3]
directory = workspace / "backend/workbook-hsk1"
cache = directory / "ocr"
cache.mkdir(parents=True, exist_ok=True)
source = next(Path("D:/").glob("Workbook Hsk 1 *.pdf"))
document = pymupdf.open(source)
for number in range(args.start, args.end + 1):
    target = cache / f"page-{number:03}.json"
    if target.exists():
        continue
    started = time.monotonic()
    page = document[number - 1]
    text_page = page.get_textpage_ocr(language="chi_sim+eng", dpi=200, full=True,
                                     tessdata=str(directory / "ocr-models"))
    data = page.get_text("dict", textpage=text_page)
    data["pdfPage"] = number
    data["text"] = page.get_text(textpage=text_page)
    data["words"] = page.get_text("words", textpage=text_page)
    target.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"OCR_PAGE {number}/{args.end}: {len(data['text'])} characters, {time.monotonic()-started:.1f}s", flush=True)
