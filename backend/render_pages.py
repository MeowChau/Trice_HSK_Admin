import pymupdf
import os

out_dir = r"d:\backend_hsk\backend\data\extracted_pages"
os.makedirs(out_dir, exist_ok=True)

hsk2_pdf = r"d:\backend_hsk\backend\data\workbooks\Workbook Hsk 2 新HSK教程2学练手册.pdf"
hsk3_pdf = r"d:\backend_hsk\backend\data\workbooks\新HSK教程3学练手册@xitoytili_luoluodafang.pdf"

def extract_sample_pages(pdf_path, prefix, page_list):
    doc = pymupdf.open(pdf_path)
    total = len(doc)
    print(f"{prefix}: total {total} pages")
    for p_num in page_list:
        if 1 <= p_num <= total:
            page = doc[p_num - 1]
            pix = page.get_pixmap(dpi=150)
            img_path = os.path.join(out_dir, f"{prefix}_page_{p_num}.png")
            pix.save(img_path)
            print(f"Saved {img_path} ({pix.width}x{pix.height})")

# HSK 2: check TOC (pages 2-6) and end pages (e.g. 150-176)
extract_sample_pages(hsk2_pdf, "hsk2", [2, 3, 4, 5, 140, 145, 150, 155, 160, 165, 170, 175, 176])

# HSK 3: check TOC (pages 2-6) and end pages (e.g. 160-187)
extract_sample_pages(hsk3_pdf, "hsk3", [2, 3, 4, 5, 150, 155, 160, 165, 170, 175, 180, 185, 186, 187])
