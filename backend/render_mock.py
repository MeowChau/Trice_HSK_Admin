import pymupdf
import os

out_dir = r"d:\backend_hsk\backend\data\extracted_pages"
hsk2_pdf = r"d:\backend_hsk\backend\data\workbooks\Workbook Hsk 2 新HSK教程2学练手册.pdf"
hsk3_pdf = r"d:\backend_hsk\backend\data\workbooks\新HSK教程3学练手册@xitoytili_luoluodafang.pdf"

doc2 = pymupdf.open(hsk2_pdf)
# In HSK 2, Mock Test is p. 151. Let's render PDF pages 155 to 176
for p in range(156, 168):
    if p <= len(doc2):
        pix = doc2[p-1].get_pixmap(dpi=150)
        pix.save(os.path.join(out_dir, f"hsk2_mock_page_{p}.png"))

doc3 = pymupdf.open(hsk3_pdf)
# In HSK 3, Mock Test is p. 167. Let's render PDF pages 171 to 187
for p in range(171, 187):
    if p <= len(doc3):
        pix = doc3[p-1].get_pixmap(dpi=150)
        pix.save(os.path.join(out_dir, f"hsk3_mock_page_{p}.png"))

print("Rendered mock exam pages for HSK 2 and HSK 3.")
