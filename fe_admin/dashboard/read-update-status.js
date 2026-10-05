const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\PendingStudentList.tsx';
let content = fs.readFileSync(file, 'utf8');

const match = content.match(/const updateStatus = async [\s\S]*?};/);
if (match) {
    console.log(match[0]);
} else {
    console.log("Could not find updateStatus.");
}