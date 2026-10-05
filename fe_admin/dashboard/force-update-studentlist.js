const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\StudentList.tsx';
let content = fs.readFileSync(file, 'utf8');

const handleActionStart = content.indexOf('const handleAction = async (userId: string, action: string) => {');
if (handleActionStart !== -1) {
    let brackets = 0;
    let end = -1;
    for (let i = handleActionStart; i < content.length; i++) {
        if (content[i] === '{') brackets++;
        if (content[i] === '}') {
            brackets--;
            if (brackets === 0) {
                end = i + 1;
                break;
            }
        }
    }
    
    if (end !== -1) {
        const newHandleAction = `const handleAction = async (userId: string, action: string) => {
    if (action === 'cancel_account') {
      showConfirm('Bạn có chắc chắn muốn hủy tài khoản này?', async () => {
        try {
          const res = await apiFetch(\`users/\${userId}\`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: { id: 2 } })
          });
          if (res.ok) {
            showAlert('Đã hủy tài khoản thành công', 'success');
            fetchUsers();
          } else {
            showAlert('Lỗi: ' + (await readApiError(res)), 'error');
          }
        } catch (err) {
          console.error(err);
          showAlert('Đã có lỗi xảy ra', 'error');
        }
      });
    } else if (action === 'revert_pending') {
      showConfirm('Bạn có chắc chắn chuyển tài khoản này về chờ duyệt?', async () => {
        try {
          const res = await apiFetch(\`users/\${userId}\`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: { id: 3 } })
          });
          if (res.ok) {
            showAlert('Đã chuyển tài khoản về trạng thái Chờ duyệt', 'success');
            fetchUsers();
          } else {
            showAlert('Lỗi: ' + (await readApiError(res)), 'error');
          }
        } catch (err) {
          console.error(err);
          showAlert('Đã có lỗi xảy ra', 'error');
        }
      });
    } else if (action === 'temp_password') {
      showConfirm('Cấp mật khẩu tạm thời cho tài khoản này?', async () => {
        try {
          const res = await apiFetch(\`users/\${userId}/temp-password\`, {
            method: 'POST'
          });
          if (res.ok) {
            const data = await res.json();
            showAlert(\`Mật khẩu tạm thời: \${data.tempPassword}\`, 'success');
          } else {
            showAlert('Lỗi: ' + (await readApiError(res)), 'error');
          }
        } catch (err) {
          console.error(err);
          showAlert('Đã có lỗi xảy ra', 'error');
        }
      });
    }
  };`;
        content = content.substring(0, handleActionStart) + newHandleAction + content.substring(end);
        console.log("Replaced handleAction.");
    }
}

// Replace all remaining alerts that were missed because of encoding/spelling
content = content.replace(/alert\((['"`].*?['"`])\);/g, 'showAlert($1, "success");');
// Fix some specific success/warning labels manually:
content = content.replace(/showAlert\("Vui l.*ng .*i.*n .*y .* th.*ng tin", "success"\);/g, 'showAlert("Vui lòng điền đầy đủ thông tin", "warning");');
content = content.replace(/showAlert\("Phi.*n .*ng nh.*p a h.*t h.*n ho.*c kh.*ng t.*m th.*y token, vui l.*ng .*ng nh.*p l.*i!", "success"\);/g, 'showAlert("Phiên đăng nhập đã hết hạn hoặc không tìm thấy token, vui lòng đăng nhập lại!", "error");');
content = content.replace(/showAlert\('L.*i: ' \+ \(await readApiError\(res\)\), "success"\);/g, 'showAlert("Lỗi: " + (await readApiError(res)), "error");');
content = content.replace(/showAlert\('Da c.* li x.*y ra', "success"\);/g, 'showAlert("Đã có lỗi xảy ra", "error");');

// Save it
fs.writeFileSync(file, content, 'utf8');
console.log("Updated alerts.");