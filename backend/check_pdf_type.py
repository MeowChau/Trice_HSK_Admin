import sys
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf
import glob
import os

for p in glob.glob(r"d:\backend_hsk\backend\data\workbooks\*.pdf"):
    doc = pymupdf.open(p)
    print("=" * 60)
    print(os.path.basename(p))
    for page_idx in [5, 10, 20, 50, 100, len(doc)-10, len(doc)-5]:
        if page_idx < len(doc):
            page = doc[page_idx]
            txt = page.get_text().strip()
            images = page.get_images()
            print(f"Page {page_idx+1}: text length = {len(txt)}, images count = {len(images)}")
            if len(txt) > 0:
                print("  Sample text:", repr(txt[:100]))
