const fs = require('fs');
const modalContent = fs.readFileSync('D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\ui\\modal\\index.tsx', 'utf8');
const alertContent = fs.readFileSync('D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\ui\\alert\\Alert.tsx', 'utf8');
console.log("MODAL PROPS:");
console.log(modalContent.split('\n').slice(0, 15).join('\n'));
console.log("\nALERT PROPS:");
console.log(alertContent.split('\n').slice(0, 15).join('\n'));