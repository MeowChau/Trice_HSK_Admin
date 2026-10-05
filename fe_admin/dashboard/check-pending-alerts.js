const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\PendingStudentList.tsx';
let content = fs.readFileSync(file, 'utf8');
if (content.includes('alert(') || content.includes('window.confirm(')) {
    console.log("Found alert/confirm in PendingStudentList.tsx");
} else {
    console.log("No alert/confirm found in PendingStudentList.tsx");
}