import pymupdf
import os

out_dir = r"d:\backend_hsk\backend\data\extracted_pages"
hsk2_pdf = r"d:\backend_hsk\backend\data\workbooks\Workbook Hsk 2 新HSK教程2学练手册.pdf"
doc = pymupdf.open(hsk2_pdf)

for p in [8, 9, 12, 13, 16, 17]:
    pix = doc[p-1].get_pixmap(dpi=150)
    pix.save(os.path.join(out_dir, f"hsk2_lesson1_p{p}.png"))

print("Saved sample lesson pages for HSK 2.")
