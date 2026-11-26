"use client";
import { useCallback } from "react";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import type { UserFilters } from "@/lib/api-types";

import React, { useEffect, useState } from "react";

import { Modal } from "../ui/modal";

import Input from "../form/input/InputField";

import Label from "../form/Label";

import Button from "../ui/button/Button";

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

  studentCode?: number | null;

  username?: string;

  currentHskLevel: number;

  status: Status;

  deletedAt: string | null;
}

export default function StudentList() {
  const requests = useLatestRequest();

  const [users, setUsers] = useState<UserRow[]>([]);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: (() => void) | null;
  }>({ isOpen: false, message: "", onConfirm: null });
  const [alertMsg, setAlertMsg] = useState<{
    isOpen: boolean;
    message: string;
    variant: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, message: "", variant: "success" });

  const showAlert = (
    message: string,
    variant: "success" | "error" | "warning" | "info" = "success",
  ) => {
    setAlertMsg({ isOpen: true, message, variant });
    setTimeout(() => setAlertMsg((prev) => ({ ...prev, isOpen: false })), 3000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  };

  const [page, setPage] = useState(1);

  const [limit] = useState(10);

  const [sortBy, setSortBy] = useState<string>("");

  const [filterLevel, setFilterLevel] = useState<string>("");

  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [newUsername, setNewUsername] = useState("");

  const [newEmail, setNewEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateUser = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();

    if (!newUsername || !newEmail || !newPassword) {
      showAlert("Vui lòng điền đầy đủ thông tin", "warning");

      return;
    }

    setIsSubmitting(true);

    try {
      const token =
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1] || localStorage.getItem("token");

      if (!token) {
        showAlert(
          "Phiên ng nhập ã hết hạn hoặc không tìm thấy token, vui lòng ng nhập lại!",
          "success",
        );

        return;
      }

      const res = await apiFetch("users", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          username: newUsername,

          email: newEmail,

          password: newPassword,

          role: { id: 2 },

          status: { id: 1 },
        }),
      });

      if (res.ok) {
        showAlert("Thêm người dùng thành công", "success");

        setIsModalOpen(false);

        setNewUsername("");

        setNewEmail("");

        setNewPassword("");

        fetchUsers();
      } else {
        alert("Lá»—i: " + (await readApiError(res)));
      }
    } catch (err) {
      console.error(err);

      showAlert("Đã có li xảy ra", "success");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    const request = requests.start();
    setIsLoading(true);

    try {
      let queryUrl = `users?page=${page}&limit=${limit}`;

      // Default filter to only show normal users (role id 2) instead of Admins
      const filtersObj: UserFilters = {
        roles: [{ id: 2 }],
        statuses: [{ id: 1 }, { id: 2 }],
      }; // Đã duyệt (1) hoặc Đã hủy (2)

      // Default sort: Status ascending (Active 1 first, Inactive 2 last) then StudentCode ascending
      let sortParams =
        '[{"orderBy":"status","order":"ASC"},{"orderBy":"studentCode","order":"ASC"}]';
      if (sortBy === "name_asc") {
        sortParams = '[{"orderBy":"firstName","order":"ASC"}]';
      } else if (sortBy === "id_asc") {
        sortParams = '[{"orderBy":"studentCode","order":"ASC"}]';
      }
      queryUrl += `&sort=${encodeURIComponent(sortParams)}`;

      if (filterLevel) {
        filtersObj["currentHskLevel"] = parseInt(filterLevel);
      }
      queryUrl += `&filters=${encodeURIComponent(JSON.stringify(filtersObj))}`;

      const res = await apiFetch(queryUrl, {
        signal: request.signal,
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (!request.isCurrent()) return;
        const lastPage = Math.max(1, data.totalPages);
        setTotalPages(lastPage);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setUsers(data.data);
      }
    } catch (err) {
      if (!request.isCurrent()) return;
      console.error("Failed to fetch users", err);
    } finally {
      if (request.isCurrent()) setIsLoading(false);
    }
  }, [requests, page, limit, sortBy, filterLevel]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAction = async (userId: string, action: string) => {
    if (action === "cancel_account") {
      showConfirm("Bạn có chắc chắn muốn hủy tài khoản này?", async () => {
        try {
          const res = await apiFetch(`users/${userId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: { id: 2 } }),
          });
          if (res.ok) {
            showAlert("Đã hủy tài khoản thành công", "success");
            fetchUsers();
          } else {
            showAlert("Lỗi: " + (await readApiError(res)), "error");
          }
        } catch (err) {
          console.error(err);
          showAlert("Đã có lỗi xảy ra", "error");
        }
      });
    } else if (action === "revert_pending") {
      showConfirm(
        "Bạn có chắc chắn chuyển tài khoản này về chờ duyệt?",
        async () => {
          try {
            const res = await apiFetch(`users/${userId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: { id: 3 } }),
            });
            if (res.ok) {
              showAlert(
                "Đã chuyển tài khoản về trạng thái Chờ duyệt",
                "success",
              );
              fetchUsers();
            } else {
              showAlert("Lỗi: " + (await readApiError(res)), "error");
            }
          } catch (err) {
            console.error(err);
            showAlert("Đã có lỗi xảy ra", "error");
          }
        },
      );
    } else if (action === "temp_password") {
      showConfirm("Cấp mật khẩu tạm thời cho tài khoản này?", async () => {
        try {
          const res = await apiFetch(`users/${userId}/temp-password`, {
            method: "POST",
          });
          if (res.ok) {
            const data = await res.json();
            showAlert(`Mật khẩu tạm thời: ${data.tempPassword}`, "success");
          } else {
            showAlert("Lỗi: " + (await readApiError(res)), "error");
          }
        } catch (err) {
          console.error(err);
          showAlert("Đã có lỗi xảy ra", "error");
        }
      });
    }
  };

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
          <Alert
            variant={alertMsg.variant}
            title={
              alertMsg.variant === "success"
                ? "Thành công"
                : alertMsg.variant === "error"
                  ? "Thất bại"
                  : "Thông báo"
            }
            message={alertMsg.message}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Danh sách tài khoản
            </h3>

            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              Thêm người dùng
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              aria-label="Sắp xếp danh sách tài khoản"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Sắp xếp (Mặc định)</option>

              <option value="name_asc">Tên (A-Z)</option>

              <option value="id_asc">Mã học viên</option>
            </select>

            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              aria-label="Lọc tài khoản theo trình độ"
              value={filterLevel}
              onChange={(e) => {
                setFilterLevel(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trình độ</option>

              <option value="1">HSK 1</option>

              <option value="2">HSK 2</option>

              <option value="3">HSK 3</option>

              <option value="4">HSK 4</option>

              <option value="5">HSK 5</option>

              <option value="6">HSK 6</option>

              <option value="7">HSK 7</option>

              <option value="8">HSK 8</option>

              <option value="9">HSK 9</option>
            </select>
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <Table className="w-full min-w-[760px]! table-fixed">
            <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
              <TableRow>
                <TableCell
                  isHeader
                  className="w-[110px] whitespace-nowrap py-3 pr-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Mã học viên
                </TableCell>

                <TableCell
                  isHeader
                  className=" whitespace-nowrap py-3 pr-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Tên người dùng
                </TableCell>

                <TableCell
                  isHeader
                  className="w-[145px] whitespace-nowrap py-3 pr-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Trình độ hiện tại
                </TableCell>

                <TableCell
                  isHeader
                  className="w-[160px] whitespace-nowrap py-3 pr-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Trạng thái tài khoản
                </TableCell>

                <TableCell
                  isHeader
                  className="w-[140px] whitespace-nowrap py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
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
                      #{user.studentCode ?? user.id}
                    </TableCell>

                    <TableCell className="py-3 pr-4">
                      <p
                        title={user.username || "Chưa cập nhật"}
                        className="truncate font-medium text-gray-800 text-theme-sm dark:text-white/90"
                      >
                        {user.username || "Chưa cập nhật"}
                      </p>
                    </TableCell>

                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {user.currentHskLevel
                        ? `HSK ${user.currentHskLevel}`
                        : "Chưa xác định"}
                    </TableCell>

                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      <Badge size="sm" color={displayStatus.color}>
                        {displayStatus.text}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleAction(user.id, "cancel_account");
                          }}
                          className="text-error-500 hover:bg-error-50 p-1.5 rounded-full transition-colors"
                          aria-label="Hủy tài khoản"
                          title="Hủy tài khoản"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleAction(user.id, "revert_pending");
                          }}
                          className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-full transition-colors"
                          aria-label="Quay lại chờ duyệt"
                          title="Quay lại chờ duyệt"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleAction(user.id, "temp_password");
                          }}
                          className="text-gray-500 hover:bg-gray-100 p-1.5 rounded-full transition-colors"
                          aria-label="Cấp mật khẩu tạm thời"
                          title="Cấp mật khẩu tạm thời"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {users.length === 0 && (
                <TableRow>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Không tìm thấy người dùng nào.
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <nav
          aria-label="Phân trang danh sách tài khoản"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 py-3 dark:border-gray-800"
        >
          <p
            aria-live="polite"
            className="whitespace-nowrap text-sm text-gray-700 dark:text-gray-400"
          >
            Trang {page}/{totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Trang trước"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={isLoading || page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Trước
            </button>
            <button
              type="button"
              aria-label="Trang sau"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={isLoading || page >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Sau
            </button>
          </div>
        </nav>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-[500px] p-5 sm:p-8"
      >
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
          Thêm người dùng mới
        </h3>

        <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="new-student-username">
              Tên người dùng <span className="text-error-500">*</span>
            </Label>

            <Input
              id="new-student-username"
              name="username"
              required
              type="text"
              placeholder="Nhập tên người dùng"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="new-student-email">
              Email <span className="text-error-500">*</span>
            </Label>

            <Input
              id="new-student-email"
              name="email"
              required
              type="email"
              placeholder="Nhập email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="new-student-password">
              Mật khẩu <span className="text-error-500">*</span>
            </Label>

            <Input
              id="new-student-password"
              name="password"
              required
              type="password"
              placeholder="Nhập mật khẩu"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Hủy
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu…" : "Lưu tài khoản"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        className="max-w-[400px] p-6"
      >
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Xác nhận
        </h3>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          {confirmDialog.message}
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() =>
              setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
            }
          >
            Hủy
          </Button>
          <Button
            onClick={() => {
              if (confirmDialog.onConfirm) confirmDialog.onConfirm();
              setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            }}
          >
            Xác nhận
          </Button>
        </div>
      </Modal>
    </>
  );
}
