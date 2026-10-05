import pymupdf
import os

doc = pymupdf.open('data/workbooks/Workbook_HSK_1_Lianxice.pdf')
out_dir = 'scratch/hsk1_lessons'
os.makedirs(out_dir, exist_ok=True)

# Render Lesson 4 pages (p 13 in book = p 20 in pdf approx)
# Let's find pages by rendering 18 to 28
for p in range(18, 30):
    page = doc[p - 1]
    pix = page.get_pixmap(dpi=150)
    pix.save(f"{out_dir}/page_{p}.png")

print("Rendered Lesson pages to scratch/hsk1_lessons")
