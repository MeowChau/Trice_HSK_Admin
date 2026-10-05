import sys
sys.stdout.reconfigure(encoding='utf-8')
import pymupdf

doc = pymupdf.open('data/workbooks/Workbook_HSK_1_Lianxice.pdf')
print('Total pages:', len(doc))
print('TOC:', doc.get_toc())

has_text = 0
for i in range(len(doc)):
    txt = doc[i].get_text().strip()
    if len(txt) > 0:
        has_text += 1
    for kw in ['第1课', '第2课', '第3课', '第4课', '第5课', '第6课', '第7课', '第8课', '第9课', '第10课', '第11课', '第12课', '第13课', '第14课', '第15课', '模拟试卷', '模拟试题', '听力材料', '参考答案', 'Lesson']:
        if kw in txt:
            snippet = txt[:120].replace('\n', ' ')
            print(f'Page {i+1} [{kw}]: {snippet}')
            break

print(f'Pages with text: {has_text}/{len(doc)}')
if has_text == 0:
    print('THIS PDF IS 100% SCANNED IMAGES (NO EMBEDDED TEXT)!')
