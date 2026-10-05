"use client";



import { MoreDotIcon } from '../../icons';

import React, { useEffect, useState } from "react";

import { Modal } from '../ui/modal';

import Input from '../form/input/InputField';

import Label from '../form/Label';

import Button from '../ui/button/Button';



import {

  Table,

  TableBody,

  TableCell,

  TableHeader,

  TableRow,

} from "../ui/table";

import Badge from "../ui/badge/Badge";
import Alert from "../ui/alert/Alert";
import { apiFetch, readApiError } from "@/lib/api";





interface Status {

  id: number;

  name: string;

}



interface UserRow {

  id: string;

  studentCode: number;

  username?: string;

  currentHskLevel: number;

  status: Status;

  deletedAt: string | null;

}



export default function StudentList() {

  const [users, setUsers] = useState<UserRow[]>([]);

  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: (() => void) | null}>({isOpen: false, message: '', onConfirm: null});
  const [alertMsg, setAlertMsg] = useState<{isOpen: boolean, message: string, variant: 'success' | 'error' | 'warning' | 'info'}>({isOpen: false, message: '', variant: 'success'});

  const showAlert = (message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'success') => {
      setAlertMsg({ isOpen: true, message, variant });
      setTimeout(() => setAlertMsg(prev => ({ ...prev, isOpen: false })), 3000);
  };
  
  const showConfirm = (message: string, onConfirm: () => void) => {
      setConfirmDialog({ isOpen: true, message, onConfirm });
  };


  const [page, setPage] = useState(1);

  const [limit] = useState(10);

  const [sortBy, setSortBy] = useState<string>(""); 

  const [filterLevel, setFilterLevel] = useState<string>("");

  const [hasNextPage, setHasNextPage] = useState(false);



  const [isModalOpen, setIsModalOpen] = useState(false);

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState('');

  const [newEmail, setNewEmail] = useState('');

  const [newPassword, setNewPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);



  const handleCreateUser = async (e?: React.FormEvent | React.MouseEvent) => {

    if (e) e.preventDefault();

    if (!newUsername || !newEmail || !newPassword) {

      showAlert("Vui lòng điền đầy đủ thông tin", "warning");

      return;

    }

    

    setIsSubmitting(true);

    try {

      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1] || localStorage.getItem('token');

      if (!token) {

        showAlert("Phiên ng nhập ã hết hạn hoặc không tìm thấy token, vui lòng ng nhập lại!", "success");

        return;

      }

      const res = await fetch(`http://localhost:3001/api/v1/users`, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json',

          Authorization: `Bearer ${token}`

        },

        body: JSON.stringify({

          username: newUsername,

          email: newEmail,

          password: newPassword,

          role: { id: 2 },

          status: { id: 1 }

        })

      });

      

      if (res.ok) {

        showAlert('Thêm người dùng thành công', "success");

        setIsModalOpen(false);

        setNewUsername('');

        setNewEmail('');

        setNewPassword('');

        fetchUsers();

      } else {

        alert('Lá»—i: ' + (await readApiError(res)));

      }

    } catch (err) {

      console.error(err);

      showAlert('Đã có li xảy ra', "success");

    } finally {

      setIsSubmitting(false);

    }

  };





    
  const updateStatus = async (id: string, statusId: number) => {
    try {
      const res = await apiFetch(`users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: { id: statusId } }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const fetchUsers = async () => {

    try {
      let queryUrl = `users?page=${page}&limit=${limit}`;
      
      // Default filter to only show normal users (role id 2) instead of Admins
      let filtersObj: any = { roles: [{ id: 2 }], statuses: [{ id: 1 }, { id: 2 }] }; // Đã duyệt (1) hoặc Đã hủy (2)
      
      // Default sort: Status ascending (Active 1 first, Inactive 2 last) then StudentCode ascending
      let sortParams = '[{"orderBy":"status","order":"ASC"},{"orderBy":"studentCode","order":"ASC"}]';
      if (sortBy === "name_asc") {
        sortParams = '[{"orderBy":"firstName","order":"ASC"}]';
      } else if (sortBy === "id_asc") {
        sortParams = '[{"orderBy":"studentCode","order":"ASC"}]';
      }
      queryUrl += `&sort=${encodeURIComponent(sortParams)}`;

      if (filterLevel) {
        filtersObj['currentHskLevel'] = parseInt(filterLevel);
      }
      queryUrl += `&filters=${encodeURIComponent(JSON.stringify(filtersObj))}`;

      const res = await apiFetch(queryUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data);
        setHasNextPage(data.hasNextPage);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {

    fetchUsers();

  }, [page, sortBy, filterLevel]);



  

  const handleAction = async (userId: string, action: string) => {
    if (action === 'cancel_account') {
      showConfirm('Bạn có chắc chắn muốn hủy tài khoản này?', async () => {
        try {
          const res = await apiFetch(`users/${userId}`, {
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
          const res = await apiFetch(`users/${userId}`, {
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
          const res = await apiFetch(`users/${userId}/temp-password`, {
            method: 'POST'
          });
          if (res.ok) {
            const data = await res.json();
            showAlert(`Mật khẩu tạm thời: ${data.tempPassword}`, 'success');
          } else {
            showAlert('Lỗi: ' + (await readApiError(res)), 'error');
          }
        } catch (err) {
          console.error(err);
          showAlert('Đã có lỗi xảy ra', 'error');
        }
      });
    }
  };;



  const getStatusDisplay = (user: UserRow) => {
    if (user.deletedAt) {
      return { text: "Đã xóa", color: "error" as const };
    }
    if (user.status?.id === 1) {
      return { text: "Đã duyệt", color: "success" as const };
    }
    if (user.status?.id === 2) {
      return { text: "Đã hủy", color: "error" as const };
    }
    if (user.status?.id === 3) {
      return { text: "Chờ duyệt", color: "warning" as const };
    }
    return { text: "Không rõ", color: "info" as const };
  };



  return (

    <>
      {alertMsg.isOpen && (
        <div className="mb-4">
          <Alert variant={alertMsg.variant} title={alertMsg.variant === 'success' ? 'Thành công' : alertMsg.variant === 'error' ? 'Thất bại' : 'Thông báo'} message={alertMsg.message} />
        </div>
      )}

    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">

      <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-4">

          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">

            Danh sách tài khoản

          </h3>

          <Button size="sm" onClick={() => setIsModalOpen(true)} >

            Thêm người dùng

          </Button>

        </div>



        <div className="flex items-center gap-3">

          <select 

            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"

            value={sortBy}

            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}

          >

            <option value="">Sắp xếp (Mặc định)</option>

            <option value="name_asc">Tên (A-Z)</option>

            <option value="id_asc">Mã học viên</option>

          </select>

          

          <select 

            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"

            value={filterLevel}

            onChange={(e) => { setFilterLevel(e.target.value); setPage(1); }}

          >

            <option value="">Tất cả trình độ </option>

            <option value="1">Trình  1</option>

            <option value="2">Trình  2</option>

            <option value="3">Trình  3</option>

            <option value="4">Trình  4</option>

            <option value="5">Trình  5</option>

            <option value="6">Trình  6</option>

            <option value="7">Trình  7</option>

            <option value="8">Trình  8</option>

            <option value="9">Trình  9</option>

          </select>

        </div>

      </div>

      <div className="max-w-full overflow-x-auto">

        <Table>

          <TableHeader className="border-gray-100 dark:border-gray-800 border-y">

            <TableRow>

              <TableCell isHeader className="w-1/4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">

                Mã học viên

              </TableCell>

              <TableCell isHeader className="w-1/4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">

                Tên người dùng

              </TableCell>

              <TableCell isHeader className="w-1/4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">

                Trình độ hiện tại

              </TableCell>

              <TableCell isHeader className="w-1/4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">

                Trạng thái tài khoản

              </TableCell>

              <TableCell isHeader className="py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">

                Thao tác

              </TableCell>

            </TableRow>

          </TableHeader>



          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">

            {users.map((user) => {

              const displayStatus = getStatusDisplay(user);

              return (

                <TableRow key={user.id}>

                  <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400 font-medium">

                    {user.studentCode ? `#${user.studentCode}` : `#${user.id}`}

                  </TableCell>

                  <TableCell className="py-3">

                    <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">

                      {user.username || "Chưa cập nhật"}

                    </p>

                  </TableCell>

                  <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">

                    {user.currentHskLevel ? `HSK ${user.currentHskLevel}` : "Chưa xác định"}

                  </TableCell>

                  <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">

                    <Badge size="sm" color={displayStatus.color}>

                      {displayStatus.text}

                    </Badge>

                  </TableCell>

                  <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400 text-center relative">
                      <button onClick={() => setOpenDropdownId(openDropdownId === user.id ? null : user.id)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <MoreDotIcon className="w-5 h-5" />
                      </button>
                      {openDropdownId === user.id && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center space-x-1 bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1 z-10 transition-all duration-200">
                          <button onClick={() => { setOpenDropdownId(null); handleAction(user.id, 'cancel_account'); }} className="text-error-500 hover:bg-error-50 p-1.5 rounded-full transition-colors" title="Hủy tài khoản">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                          </button>
                          <button onClick={() => { setOpenDropdownId(null); handleAction(user.id, 'revert_pending'); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-full transition-colors" title="Quay lại chờ duyệt">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                          </button>
                          <button onClick={() => { setOpenDropdownId(null); handleAction(user.id, 'temp_password'); }} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded-full transition-colors" title="Cấp mật khẩu tạm thời">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                          </button>
                        </div>
                      )}
                    </TableCell>

                </TableRow>

              );

            })}

            

            {users.length === 0 && (

              <TableRow>

                <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">

                  Không tìm thấy người dùng nào.

                </td>

              </TableRow>

            )}

          </TableBody>

        </Table>

      </div>

      

      {/* Pagination Controls */}

      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-800 dark:bg-white/[0.03] mt-4 rounded-b-2xl">

        <div className="flex flex-1 justify-between sm:hidden">

          <button

            onClick={() => setPage(p => Math.max(1, p - 1))}

            disabled={page === 1}

            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"

          >

            Trưc

          </button>

          <button

            onClick={() => setPage(p => p + 1)}

            disabled={!hasNextPage}

            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"

          >

            Sau

          </button>

        </div>

        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">

          <div>

            <p className="text-sm text-gray-700 dark:text-gray-400">

              Trang <span className="font-medium">{page}</span>

            </p>

          </div>

          <div>

            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">

              <button

                onClick={() => setPage(p => Math.max(1, p - 1))}

                disabled={page === 1}

                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 dark:ring-gray-700 dark:hover:bg-gray-800"

              >

                <span className="sr-only">Previous</span>

                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />

                </svg>

              </button>

              <button

                onClick={() => setPage(p => p + 1)}

                disabled={!hasNextPage}

                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 dark:ring-gray-700 dark:hover:bg-gray-800"

              >

                <span className="sr-only">Next</span>

                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">

                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />

                </svg>

              </button>

            </nav>

          </div>

        </div>

      </div>

    </div>



      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} className="max-w-[500px] p-5 sm:p-8">

        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">Thêm người dùng mi</h3>

        <div className="flex flex-col gap-4">

          <div>

            <Label>Tên người dùng</Label>

            <Input type="text" placeholder="Nhập tên người dùng" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />

          </div>

          <div>

            <Label>Email</Label>

            <Input type="email" placeholder="Nhập email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />

          </div>

          <div>

            <Label>Mật khẩu</Label>

            <Input type="password" placeholder="Nhập mật khẩu" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />

          </div>

          <div className="mt-4 flex justify-end gap-3">

            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>

            <Button onClick={handleCreateUser} disabled={isSubmitting}>Lưu tài khoản</Button>

          </div>

        </div>

      </Modal>

    
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

    </>

  );

}


