const fs = require('fs');
const file = 'D:\\trice_hsk\\fe_admin\\dashboard\\src\\components\\students\\StudentList.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Alert import
if (!content.includes('import Alert')) {
    content = content.replace('import Badge from "../ui/badge/Badge";', 'import Badge from "../ui/badge/Badge";\nimport Alert from "../ui/alert/Alert";');
}

// 2. Add states and helper functions
const stateInjection = `
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: (() => void) | null}>({isOpen: false, message: '', onConfirm: null});
  const [alertMsg, setAlertMsg] = useState<{isOpen: boolean, message: string, variant: 'success' | 'error' | 'warning' | 'info'}>({isOpen: false, message: '', variant: 'success'});

  const showAlert = (message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'success') => {
      setAlertMsg({ isOpen: true, message, variant });
      setTimeout(() => setAlertMsg(prev => ({ ...prev, isOpen: false })), 3000);
  };
  
  const showConfirm = (message: string, onConfirm: () => void) => {
      setConfirmDialog({ isOpen: true, message, onConfirm });
  };
`;

content = content.replace('const [users, setUsers] = useState<UserRow[]>([]);', 'const [users, setUsers] = useState<UserRow[]>([]);\n' + stateInjection);

// 3. Replace alert(...) with showAlert(...)
content = content.replace(/alert\("Vui lng i\?n \?y \? thng tin"\);/g, 'showAlert("Vui lòng điền đầy đủ thông tin", "warning");');
content = content.replace(/alert\("Phin ng nh\?p a h\?t h\?n ho\?c khng tm th\?y token, vui lng ng nh\?p l\?i!"\);/g, 'showAlert("Phiên đăng nhập đã hết hạn hoặc không tìm thấy token, vui lòng đăng nhập lại!", "error");');
content = content.replace(/alert\('Thm ngu\?i dng thnh cng'\);/g, 'showAlert("Thêm người dùng thành công", "success");');
content = content.replace(/alert\('L-i: ' \+ \(await readApiError\(res\)\)\);/g, 'showAlert("Lỗi: " + (await readApiError(res)), "error");');
content = content.replace(/alert\('Da c li x\?y ra'\);/g, 'showAlert("Đã có lỗi xảy ra", "error");');
content = content.replace(/alert\('Da chuyn ti kho\?n v\? tr\?ng thi Ch\? duyt'\);/g, 'showAlert("Đã chuyển tài khoản về trạng thái Chờ duyệt", "success");');
content = content.replace(/alert\('Da h\?y ti kho\?n thnh cng'\);/g, 'showAlert("Đã hủy tài khoản thành công", "success");');
content = content.replace(/alert\(`M\?t kh\?u t\?m th\?i cho ti kho\?n ny l: \$\{data\.tempPassword\}\\nVui lng copy v g\?i cho ngu\?i dng\.\`\);/g, 'showAlert(`Mật khẩu tạm thời cho tài khoản này là: ${data.tempPassword} - Vui lòng copy và gửi cho người dùng.`, "success");');

// 4. Fix window.confirm in handleAction
// Originally: if (!window.confirm('B?n c ch?c ch?n mun h?y ti kho?n ny?')) return; ...
// We need to wrap the rest of the function in the onConfirm callback, which is tricky with regex.
// Let's replace the whole handleAction function.

const handleActionRegex = /const handleAction = async \(userId: string, action: string\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?alert\('Da c li x\?y ra'\);\s*\}\s*\};/;
const newHandleAction = `
  const handleAction = async (userId: string, action: string) => {
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
  };
`;
content = content.replace(handleActionRegex, newHandleAction);

// 5. Render Alert at the top of the table
const tableHeaderStart = '<div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">';
const alertRender = `
      {alertMsg.isOpen && (
        <div className="mb-4">
          <Alert variant={alertMsg.variant} title={alertMsg.variant === 'success' ? 'Thành công' : alertMsg.variant === 'error' ? 'Thất bại' : 'Thông báo'} message={alertMsg.message} />
        </div>
      )}
`;
content = content.replace(tableHeaderStart, alertRender + '\n' + tableHeaderStart);

// 6. Render Confirm Modal at the end of the file, just before the closing tag.
// Find the last </Modal> or just before `</>`
const modalRender = `
      <Modal isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="max-w-[400px] p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Xác nhận</h3>
        <p className="mb-6 text-gray-600 dark:text-gray-400">{confirmDialog.message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>Hủy</Button>
          <Button onClick={() => {
            if (confirmDialog.onConfirm) confirmDialog.onConfirm();
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }}>Xác nhận</Button>
        </div>
      </Modal>
`;
content = content.replace('</>', modalRender + '\n    </>');

fs.writeFileSync(file, content, 'utf8');
console.log("Updated StudentList.tsx with custom Alert and Modal.");