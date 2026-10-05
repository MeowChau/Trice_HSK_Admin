const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\PendingStudentList.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove openDropdownId state
content = content.replace(/const \[openDropdownId, setOpenDropdownId\] = useState<string \| null>\(null\);\r?\n/g, '');

// Remove MoreDotIcon import
content = content.replace(/import \{ MoreDotIcon \} from "\.\.\/theme\/icons\/MoreDotIcon";\r?\n/g, '');

// Remove handleAction function
const handleActionStart = content.indexOf('const handleAction');
if (handleActionStart !== -1) {
    let brackets = 0;
    let end = -1;
    for (let i = handleActionStart; i < content.length; i++) {
        if (content[i] === '{') brackets++;
        if (content[i] === '}') {
            brackets--;
            if (brackets === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end !== -1) {
        content = content.substring(0, handleActionStart) + content.substring(end);
    }
}

// Remove title that says "Danh sách tài khoản" and replace with "Học viên chờ duyệt"
content = content.replace(/<h3 className="text-lg font-semibold text-gray-800 dark:text-white\/90">\s*Danh sách tài khoản\s*<\/h3>/g, '<h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Học viên chờ duyệt</h3>');

fs.writeFileSync(file, content, 'utf8');
console.log("Cleaned up remaining unused variables and updated title in PendingStudentList.tsx");