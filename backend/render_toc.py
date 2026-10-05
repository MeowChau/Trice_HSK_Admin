import pymupdf
import os

out_dir = r"d:\backend_hsk\backend\data\extracted_pages"
hsk2_pdf = r"d:\backend_hsk\backend\data\workbooks\Workbook Hsk 2 新HSK教程2学练手册.pdf"
hsk3_pdf = r"d:\backend_hsk\backend\data\workbooks\新HSK教程3学练手册@xitoytili_luoluodafang.pdf"

doc2 = pymupdf.open(hsk2_pdf)
for p in [6, 7, 8, 9, 10]:
    pix = doc2[p-1].get_pixmap(dpi=150)
    pix.save(os.path.join(out_dir, f"hsk2_page_{p}.png"))

doc3 = pymupdf.open(hsk3_pdf)
for p in [6, 7, 8, 9, 10]:
    pix = doc3[p-1].get_pixmap(dpi=150)
    pix.save(os.path.join(out_dir, f"hsk3_page_{p}.png"))

print("Saved pages 6-10 for HSK 2 and HSK 3.")
