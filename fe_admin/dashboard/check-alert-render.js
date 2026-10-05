const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\StudentList.tsx';
let content = fs.readFileSync(file, 'utf8');

const renderIndex = content.indexOf('<div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">');
if (renderIndex !== -1) {
    console.log(content.substring(Math.max(0, renderIndex - 300), renderIndex + 300));
} else {
    console.log("Could not find tableHeaderStart.");
}