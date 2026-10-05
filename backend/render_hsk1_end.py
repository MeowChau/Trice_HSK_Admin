import pymupdf
import os

doc = pymupdf.open('data/workbooks/Workbook_HSK_1_Lianxice.pdf')
out_dir = 'scratch/hsk1_end_pages'
os.makedirs(out_dir, exist_ok=True)

# Render pages from 120 to 139
for p in range(120, len(doc) + 1):
    page = doc[p - 1]
    pix = page.get_pixmap(dpi=150)
    pix.save(f"{out_dir}/page_{p}.png")

print(f"Rendered end pages from 120 to {len(doc)} to {out_dir}")
