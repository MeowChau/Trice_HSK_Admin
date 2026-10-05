const fs = require('fs');
const alertContent = fs.readFileSync('D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\ui\\alert\\Alert.tsx', 'utf8');
const modalContent = fs.readFileSync('D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\ui\\modal\\Modal.tsx', 'utf8');
console.log("ALERT:");
console.log(alertContent.split('\n').slice(0, 30).join('\n'));
console.log("\nMODAL:");
console.log(modalContent.split('\n').slice(0, 30).join('\n'));