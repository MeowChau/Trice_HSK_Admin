const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\StudentList.tsx';
let content = fs.readFileSync(file, 'utf8');

const renderIndex = content.indexOf('return (');
if (renderIndex !== -1) {
    console.log(content.substring(renderIndex, renderIndex + 400));
} else {
    console.log("Could not find return (.");
}