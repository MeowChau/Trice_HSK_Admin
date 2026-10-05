const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\StudentList.tsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
console.log(lines.slice(0, 70).join('\n'));