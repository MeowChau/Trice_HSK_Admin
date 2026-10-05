const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\PendingStudentList.tsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
console.log(lines.slice(320, 390).join('\n'));