"use client";
import { useCallback } from "react";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import type { UserFilters } from "@/lib/api-types";

import { MoreDotIcon } from "../../icons";

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
import { apiFetch, getToken, readApiError } from "@/lib/api";

type CreateUserField = "username" | "email" | "password";
type CreateUserErrors = Partial<Record<CreateUserField, string>>;

function validateCreateUserField(field: CreateUserField, value: string) {
  if (!value.trim()) {
    return {
      username: "Tên không được để trống.",
      email: "Vui lòng nhập email.",
      password: "Vui lòng nhập mật khẩu.",
    }[field];
  }
  if (field === "username" && Array.from(value.trim()).length > 255) {
    return "Tên người dùng không được vượt quá 255 ký tự.";
  }
  if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return "Vui lòng nhập địa chỉ email hợp lệ.";
  }
  if (field === "password") {
    const length = Array.from(value).length;
    if (length < 6) {
      return "Mật khẩu phải có ít nhất 6 ký tự.";
    }
    if (length > 72) {
      return "Mật khẩu không được vượt quá 72 ký tự.";
    }
  }
}

function getCreateUserErrors(payload: unknown): CreateUserErrors {
  if (!payload || typeof payload !== "object") return {};
  const data = payload as Record<string, unknown>;
  const details =
    data.errors && typeof data.errors === "object"
      ? (data.errors as Record<string, unknown>)
      : {};
  const messages = Array.isArray(data.message)
    ? data.message.filter(
        (message): message is string => typeof message === "string",
      )
    : [];
  const errors: CreateUserErrors = {};

  for (const field of ["username", "email", "password"] as const) {
    const detail = details[field];
    const message =
      typeof detail === "string"
        ? detail
        : messages
            .filter((message) => message.startsWith(`${field} `))
            .join(", ");
    if (!message) continue;

    if (field === "email") {
      errors.email = /emailAlreadyExists|already exists|already in use/i.test(
        message,
      )
        ? "Email này đã tồn tại. Vui lòng dùng email khác."
        : "Vui lòng nhập địa chỉ email hợp lệ.";
    } else if (field === "password") {
      errors.password = /minLength|longer than or equal to 6|at least 6/i.test(
        message,
      )
        ? "Mật khẩu phải có ít nhất 6 ký tự."
        : /maxLength|shorter than or equal to 72|at most 72/i.test(message)
          ? "Mật khẩu không được vượt quá 72 ký tự."
          : "Mật khẩu phải có từ 6 đến 72 ký tự.";
    } else {
      errors.username =
        /usernameAlreadyExists|already exists|already in use/i.test(message)
          ? "Tên người dùng này đã tồn tại. Vui lòng chọn tên khác."
          : /isNotEmpty|should not be empty|longer than or equal to 1/i.test(message)
            ? "Tên không được để trống."
            : "Tên người dùng phải có từ 1 đến 255 ký tự.";
    }
  }
  return errors;
}

interface Status {
  id: number;

  name: string;
}

interface UserRow {
  id: string;

  studentCode: number | null;

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
    setTimeout(() => setAlertMsg((prev) => ({ ...prev, isOpen: false })), 5000);
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

  const [newUsername, setNewUsername] = useState("");

  const [newEmail, setNewEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<CreateUserErrors>({});
  const [createError, setCreateError] = useState("");

  const closeCreateModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setCreateErrors({});
    setCreateError("");
  };

  const updateCreateField = (field: CreateUserField, value: string) => {
    const setters = {
      username: setNewUsername,
      email: setNewEmail,
      password: setNewPassword,
    };
    setters[field](value);
    setCreateError("");
    setCreateErrors((previous) =>
      previous[field]
        ? { ...previous, [field]: validateCreateUserField(field, value) }
        : previous,
    );
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const values = {
      username: newUsername.trim(),
      email: newEmail.trim(),
      password: newPassword,
    };
    const errors: CreateUserErrors = {};
    for (const field of Object.keys(values) as CreateUserField[]) {
      const error = validateCreateUserField(field, values[field]);
      if (error) errors[field] = error;
    }
    setCreateErrors(errors);
    setCreateError("");
    const firstInvalidField = Object.keys(errors)[0];
    if (firstInvalidField) {
      document.getElementById(`new-student-${firstInvalidField}`)?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      const token = getToken();

      if (!token) {
        setCreateError(
          "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để thêm người dùng.",
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
          username: values.username,

          email: values.email,

          password: values.password,

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

        setCreateErrors({});

        fetchUsers();
      } else {
        const details: unknown = await res.json().catch(() => null);
        const fieldErrors = getCreateUserErrors(details);
        if (Object.keys(fieldErrors).length > 0) {
          setCreateErrors(fieldErrors);
          return;
        }
        const message =
          res.status === 401
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : res.status === 403
              ? "Bạn không có quyền thêm người dùng. Vui lòng liên hệ quản trị viên."
              : res.status === 409
                ? "Thông tin tài khoản đã tồn tại. Vui lòng kiểm tra lại tên người dùng và email."
                : res.status === 429
                  ? "Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ một lúc rồi thử lại."
                  : res.status >= 500
                    ? "Máy chủ đang gặp lỗi. Vui lòng thử lại sau."
                    : "Thông tin tài khoản chưa hợp lệ. Vui lòng kiểm tra lại các ô nhập.";
        setCreateError(message);
      }
    } catch (err) {
      console.error(err);

      setCreateError("Không thể lưu tài khoản. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    const request = requests.start();

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
        sortParams =
          '[{"orderBy":"username","order":"ASC"},{"orderBy":"id","order":"ASC"}]';
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
        setUsers(data.data);
        setHasNextPage(data.hasNextPage);
      }
    } catch (err) {
      if (!request.isCurrent()) return;
      console.error("Failed to fetch users", err);
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
        <div
          role={alertMsg.variant === "error" ? "alert" : "status"}
          aria-atomic="true"
          className="fixed bottom-4 left-4 right-4 z-[100000] sm:bottom-6 sm:left-auto sm:right-6 sm:w-full sm:max-w-sm"
        >
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
        <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Danh sách tài khoản
            </h3>

            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              Thêm người dùng
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
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
              value={filterLevel}
              onChange={(e) => {
                setFilterLevel(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trình độ </option>

              <option value="1">Trình 1</option>

              <option value="2">Trình 2</option>

              <option value="3">Trình 3</option>

              <option value="4">Trình 4</option>

              <option value="5">Trình 5</option>

              <option value="6">Trình 6</option>

              <option value="7">Trình 7</option>

              <option value="8">Trình 8</option>

              <option value="9">Trình 9</option>
            </select>
          </div>
        </div>

        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
              <TableRow>
                <TableCell
                  isHeader
                  className="w-1/4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Mã học viên
                </TableCell>

                <TableCell
                  isHeader
                  className="w-1/4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Tên người dùng
                </TableCell>

                <TableCell
                  isHeader
                  className="w-1/4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Trình độ hiện tại
                </TableCell>

                <TableCell
                  isHeader
                  className="w-1/4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Trạng thái tài khoản
                </TableCell>

                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
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
                      {user.studentCode
                        ? `#${user.studentCode}`
                        : "Chưa cấp mã"}
                    </TableCell>

                    <TableCell className="py-3">
                      <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
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

                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400 text-center relative">
                      <button
                        onClick={() =>
                          setOpenDropdownId(
                            openDropdownId === user.id ? null : user.id,
                          )
                        }
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <MoreDotIcon className="w-5 h-5" />
                      </button>
                      {openDropdownId === user.id && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center space-x-1 bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1 z-10 transition-all duration-200">
                          <button
                            onClick={() => {
                              setOpenDropdownId(null);
                              handleAction(user.id, "cancel_account");
                            }}
                            className="text-error-500 hover:bg-error-50 p-1.5 rounded-full transition-colors"
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
                            onClick={() => {
                              setOpenDropdownId(null);
                              handleAction(user.id, "revert_pending");
                            }}
                            className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-full transition-colors"
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
                            onClick={() => {
                              setOpenDropdownId(null);
                              handleAction(user.id, "temp_password");
                            }}
                            className="text-gray-500 hover:bg-gray-100 p-1.5 rounded-full transition-colors"
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
                      )}
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

        {/* Pagination Controls */}

        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-800 dark:bg-white/[0.03] mt-4 rounded-b-2xl">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              Trưc
            </button>

            <button
              onClick={() => setPage((p) => p + 1)}
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
              <nav
                className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                aria-label="Pagination"
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 dark:ring-gray-700 dark:hover:bg-gray-800"
                >
                  <span className="sr-only">Previous</span>

                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNextPage}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 dark:ring-gray-700 dark:hover:bg-gray-800"
                >
                  <span className="sr-only">Next</span>

                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeCreateModal}
        className="max-w-[500px] p-5 sm:p-8"
      >
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
          Thêm người dùng mới
        </h3>

        <form
          noValidate
          onSubmit={handleCreateUser}
          aria-busy={isSubmitting}
          className="flex flex-col gap-4"
        >
          {createError && (
            <Alert
              variant="error"
              title="Không thể lưu tài khoản"
              message={createError}
            />
          )}
          <div>
            <Label htmlFor="new-student-username">
              Tên người dùng <span className="text-error-500">*</span>
            </Label>

            <Input
              type="text"
              id="new-student-username"
              name="username"
              autoComplete="username"
              required
              placeholder="Nhập tên người dùng"
              value={newUsername}
              onChange={(e) => updateCreateField("username", e.target.value)}
              error={Boolean(createErrors.username)}
              hint={createErrors.username}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <Label htmlFor="new-student-email">
              Email <span className="text-error-500">*</span>
            </Label>

            <Input
              type="email"
              id="new-student-email"
              name="email"
              autoComplete="email"
              required
              placeholder="Nhập email"
              value={newEmail}
              onChange={(e) => updateCreateField("email", e.target.value)}
              error={Boolean(createErrors.email)}
              hint={createErrors.email}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <Label htmlFor="new-student-password">
              Mật khẩu <span className="text-error-500">*</span>
            </Label>

            <Input
              type="password"
              id="new-student-password"
              name="password"
              autoComplete="new-password"
              required
              placeholder="Nhập mật khẩu từ 6 đến 72 ký tự"
              value={newPassword}
              onChange={(e) => updateCreateField("password", e.target.value)}
              error={Boolean(createErrors.password)}
              hint={createErrors.password}
              disabled={isSubmitting}
            />
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={closeCreateModal}
              disabled={isSubmitting}
            >
              Hủy
            </Button>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : "Lưu tài khoản"}
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
