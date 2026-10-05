import os

path = r"d:\trice_hsk\fe_admin\dashboard\src\components\students\StudentList.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the roles filter
content = content.replace("role: { id: 2 }", "roles: [{ id: 2 }]")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed roles safely")
