const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\StudentList.tsx';
let content = fs.readFileSync(file, 'utf8');

if (content.includes('alert(')) {
    console.log("alert() still found in StudentList.tsx.");
} else {
    console.log("No alert() found in StudentList.tsx.");
}

const match = content.match(/const handleAction[\s\S]*?};/);
if (match) {
    console.log("handleAction:\n" + match[0].substring(0, 500));
}