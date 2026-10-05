import sys
import pymupdf
import os

doc = pymupdf.open('data/workbooks/Workbook_HSK_1_Lianxice.pdf')
out_dir = 'scratch/hsk1_preview'
os.makedirs(out_dir, exist_ok=True)

# Render pages: 1 to 8 (TOC / intro), and sample lesson pages, and end pages (mock exam / answers)
sample_pages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 110, 115, 120, 125, 130, 135, 138]

for p in sample_pages:
    if p <= len(doc):
        page = doc[p - 1]
        pix = page.get_pixmap(dpi=150)
        pix.save(f"{out_dir}/page_{p}.png")

print(f"Rendered {len(sample_pages)} preview pages to {out_dir}")
