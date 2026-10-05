const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('D:\\trice_hsk\\fe_admin\\dashboard\\package.json', 'utf8'));
console.log(Object.keys(pkg.dependencies).filter(d => d.includes('toast') || d.includes('alert') || d.includes('sonner') || d.includes('sweetalert')));