# -*- coding: utf-8 -*-
import base64
log_path = r'C:\Users\Hi\.gemini\antigravity-ide\brain\e6760e4e-8916-44a4-9bf7-3ae751b10cc7\.system_generated\tasks\task-227.log'
with open(log_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

b64_str = ''
for line in lines:
    line = line.strip()
    if len(line) > 100 and ' ' not in line:
        b64_str += line

b = base64.b64decode(b64_str)
s = b.decode('utf-8').replace('\ufeff', '')

try:
    s = s.encode('cp1252').decode('utf-8')
except Exception as e:
    s = s.encode('latin1', errors='ignore').decode('utf-8', errors='ignore')

old_s = '      if (user.status?.id === 2 || user.status?.id === 3) {\n        return { text: "Chờ duyệt", color: "warning" as const };\n      }'
new_s = '      if (user.status?.id === 2) {\n        return { text: "Đã hủy", color: "error" as const };\n      }\n      if (user.status?.id === 3) {\n        return { text: "Chờ duyệt", color: "warning" as const };\n      }'
s = s.replace(old_s, new_s)

path = r'd:\trice_hsk\fe_admin\dashboard\src\components\students\StudentList.tsx'
with open(path, 'w', encoding='utf-8') as f:
    f.write(s)
print('Restored successfully')
