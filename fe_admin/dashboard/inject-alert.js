const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\StudentList.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStart = 'return (\r\n\r\n    <>\r\n';
const targetStart2 = 'return (\n\n    <>\n';
const targetStart3 = 'return (\r\n    <>\r\n';
const targetStart4 = 'return (\n    <>\n';

const alertRender = `      {alertMsg.isOpen && (
        <div className="mb-4">
          <Alert variant={alertMsg.variant} title={alertMsg.variant === 'success' ? 'Thành công' : alertMsg.variant === 'error' ? 'Thất bại' : 'Thông báo'} message={alertMsg.message} />
        </div>
      )}
`;

if (content.includes(targetStart)) {
    content = content.replace(targetStart, targetStart + alertRender);
} else if (content.includes(targetStart2)) {
    content = content.replace(targetStart2, targetStart2 + alertRender);
} else if (content.includes(targetStart3)) {
    content = content.replace(targetStart3, targetStart3 + alertRender);
} else if (content.includes(targetStart4)) {
    content = content.replace(targetStart4, targetStart4 + alertRender);
} else if (content.includes('return (\n    <>')) {
    content = content.replace('return (\n    <>', 'return (\n    <>\n' + alertRender);
} else {
    // Just replace `<>` with `<>\n{alertRender}` globally (should be only one root <>)
    content = content.replace(/<>/g, '<>\n' + alertRender);
}

fs.writeFileSync(file, content, 'utf8');
console.log("Injected alertRender.");