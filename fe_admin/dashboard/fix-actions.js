const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\PendingStudentList.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStart = '<TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400 text-center relative">';
const targetEnd = '</TableCell>';

const startIndex = content.lastIndexOf(targetStart);
if (startIndex !== -1) {
  const endIndex = content.indexOf(targetEnd, startIndex);
  if (endIndex !== -1) {
    const replacement = `
                  <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button onClick={() => updateStatus(user.id, 1)} className="text-green-500 hover:text-green-700 hover:bg-green-50 p-1.5 rounded-full transition-colors" title="Duyệt">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button onClick={() => updateStatus(user.id, 2)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-full transition-colors" title="Hủy">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </TableCell>
        `.trim();
    content = content.substring(0, startIndex) + replacement + content.substring(endIndex + targetEnd.length);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Replaced action column ian PendingStudentList.tsx");
  } else {
    console.log("Could not find end of TableCell.");
  }
} else {
  console.log("Could not find targetStart.");
}