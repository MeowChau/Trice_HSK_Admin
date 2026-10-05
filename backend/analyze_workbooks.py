import sys
sys.stdout.reconfigure(encoding='utf-8')

import pymupdf
import os
import glob

workbook_dir = r"d:\backend_hsk\backend\data\workbooks"
pdf_files = glob.glob(os.path.join(workbook_dir, "*.pdf"))

print(f"Found {len(pdf_files)} PDF files in {workbook_dir}:")
for p in pdf_files:
    print(f" - {os.path.basename(p)} ({os.path.getsize(p)} bytes)")

for p in pdf_files:
    fname = os.path.basename(p)
    print("=" * 60)
    print(f"Analyzing: {fname}")
    try:
        doc = pymupdf.open(p)
        print(f"Page count: {len(doc)}")
        
        toc = doc.get_toc()
        if toc:
            print(f"TOC has {len(toc)} items:")
            for item in toc[:25]:
                print("   ", item)
            if len(toc) > 25:
                print("   ... and more")
        else:
            print("No embedded TOC.")

        total = len(doc)
        start_check = max(0, total - 45)
        print(f"Scanning pages {start_check} to {total} for Mock Exam & Answer Key...")
        
        found_sections = []
        for page_num in range(start_check, total):
            text = doc[page_num].get_text()
            for keyword in ["模拟试题", "模拟试卷", "第1课", "参考答案", "听力材料", "HSK（二级）", "HSK（三级）", "HSK (二级)", "HSK (三级)"]:
                if keyword in text:
                    found_sections.append((page_num + 1, keyword, text[:120].replace('\n', ' ')))
                    break
        
        for pnum, kw, preview in found_sections[:15]:
            print(f" Page {pnum} [{kw}]: {preview}...")
            
    except Exception as e:
        print(f"Error reading {fname}: {e}")
