"use client";
import { useCallback } from "react";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import type { UserFilters } from "@/lib/api-types";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MoreDotIcon, EyeIcon, EyeCloseIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import Alert from "@/components/ui/alert/Alert";
import { apiFetch, readApiError, API_BASE_URL } from "@/lib/api";
import { resolveFileUrl } from "@/lib/media-url";

interface Status {
  id: number;
  name: string;
}

interface TeacherPhoto {
  id: string;
  path: string;
}

interface TeacherRow {
  id: string | number;
  username: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  photo?: TeacherPhoto | null;
  status: Status;
  deletedAt?: string | null;
  email?: string | null;
}

export default function TeacherList() {
  const requests = useLatestRequest();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Alerts & Confirmations
  const [alertMsg, setAlertMsg] = useState<{
    isOpen: boolean;
    message: string;
    variant: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, message: "", variant: "success" });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({ isOpen: false, title: "Xác nhận", message: "", onConfirm: null });

  // Temp Password display modal
  const [tempPassModal, setTempPassModal] = useState<{
    isOpen: boolean;
    email: string;
    tempPassword: string;
  }>({ isOpen: false, email: "", tempPassword: "" });

  const showAlert = (
    message: string,
    variant: "success" | "error" | "warning" | "info" = "success",
  ) => {
    setAlertMsg({ isOpen: true, message, variant });
    setTimeout(() => setAlertMsg((prev) => ({ ...prev, isOpen: false })), 4000);
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState<string>("");
  const [filterPosition, setFilterPosition] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [hasNextPage, setHasNextPage] = useState(false);

  // Dropdown menu state per row
  const [openDropdownId, setOpenDropdownId] = useState<string | number | null>(
    null,
  );

  // Add Teacher Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPosition, setNewPosition] = useState("Bậc 1");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Teacher Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<
    string | number | null
  >(null);
  const [editEmail, setEditEmail] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editPosition, setEditPosition] = useState("Bậc 1");
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [editPreviewAvatar, setEditPreviewAvatar] = useState<string | null>(
    null,
  );
  const [editRemovePhoto, setEditRemovePhoto] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch teachers list (RoleEnum.teacher = 3)
  const fetchTeachers = useCallback(async () => {
    const request = requests.start();
    setIsLoading(true);
    try {
      let queryUrl = `users?page=${page}&limit=${limit}`;

      const filtersObj: UserFilters = {
        roles: [{ id: 3 }], // Giáo viên có role ID = 3
      };

      if (filterStatus) {
        filtersObj.statuses = [{ id: parseInt(filterStatus) }];
      } else {
        filtersObj.statuses = [{ id: 1 }, { id: 2 }]; // Mặc định hiển thị Hoạt động và Đã hủy
      }

      if (filterPosition) {
        filtersObj.position = filterPosition;
      }

      queryUrl += `&filters=${encodeURIComponent(JSON.stringify(filtersObj))}`;

      // Sorting
      let sortParams =
        '[{"orderBy":"status","order":"ASC"},{"orderBy":"createdAt","order":"DESC"}]';
      if (sortBy === "name_asc") {
        sortParams = '[{"orderBy":"fullName","order":"ASC"}]';
      } else if (sortBy === "email_asc") {
        sortParams = '[{"orderBy":"email","order":"ASC"}]';
      }
      queryUrl += `&sort=${encodeURIComponent(sortParams)}`;

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
        setTeachers(data.data || []);
        setHasNextPage(Boolean(data.hasNextPage));
      } else {
        showAlert("Không thể tải danh sách giảng viên", "error");
      }
    } catch (err) {
      if (!request.isCurrent()) return;
      console.error("Failed to fetch teachers", err);
      showAlert("Đã có lỗi xảy ra khi tải dữ liệu", "error");
    } finally {
      if (request.isCurrent()) {
        setIsLoading(false);
      }
    }
  }, [requests, page, limit, sortBy, filterPosition, filterStatus]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  // Handle avatar file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewAvatar(URL.createObjectURL(file));
    }
  };

  // Reset modal form
  const resetForm = () => {
    setNewEmail("");
    setNewFullName("");
    setNewPosition("Bậc 1");
    setNewPassword("");
    setShowPassword(false);
    setSelectedFile(null);
    setPreviewAvatar(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit new teacher
  const handleCreateTeacher = async (
    e?: React.FormEvent | React.MouseEvent,
  ) => {
    if (e) e.preventDefault();

    if (!newEmail.trim()) {
      showAlert("Vui lòng nhập email giảng viên", "warning");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      showAlert("Định dạng email không hợp lệ", "warning");
      return;
    }

    if (!newFullName.trim()) {
      showAlert("Vui lòng nhập họ và tên giảng viên", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      let photoId: string | undefined = undefined;

      // 1. Upload photo if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploadRes = await apiFetch("files/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          photoId = uploadData.file?.id;
        } else {
          const errorMsg = await readApiError(uploadRes);
          showAlert(`Tải ảnh đại diện thất bại: ${errorMsg}`, "error");
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Call admin teacher creation endpoint
      const payload: {
        email: string;
        username: string;
        fullName: string;
        position: string;
        password?: string;
        photo?: { id: string } | null;
      } = {
        email: newEmail.trim(),
        username: newEmail.trim(), // Thay hẳn bằng email giảng viên
        fullName: newFullName.trim(),
        position: newPosition,
        password: newPassword.trim() || "123456",
      };

      if (photoId) {
        payload.photo = { id: photoId };
      }

      const res = await apiFetch("admin/users/teacher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showAlert("Thêm giảng viên thành công!", "success");
        setIsModalOpen(false);
        resetForm();
        fetchTeachers();
      } else {
        const errMsg = await readApiError(res);
        showAlert(`Lỗi tạo giảng viên: ${errMsg}`, "error");
      }
    } catch (err) {
      console.error("Error creating teacher:", err);
      showAlert("Đã có lỗi xảy ra khi tạo tài khoản giảng viên", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Action: Hủy (Cancel/Deactivate) & Cấp mật khẩu tạm thời (Issue temp password)
  const handleAction = async (
    teacher: TeacherRow,
    action: "cancel" | "reactivate" | "temp_password",
  ) => {
    setOpenDropdownId(null);

    const displayName = teacher.fullName || teacher.email || teacher.username;

    if (action === "cancel") {
      showConfirm(
        "Hủy tài khoản giảng viên",
        `Bạn có chắc chắn muốn hủy tài khoản giảng viên "${displayName}"? Sau khi hủy, tài khoản này sẽ bị vô hiệu hóa quyền truy cập.`,
        async () => {
          try {
            const res = await apiFetch(`users/${teacher.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: { id: 2 } }), // 2 = Inactive / Đã hủy
            });

            if (res.ok) {
              showAlert(
                `Đã hủy tài khoản giảng viên "${displayName}" thành công`,
                "success",
              );
              fetchTeachers();
            } else {
              showAlert("Lỗi: " + (await readApiError(res)), "error");
            }
          } catch (err) {
            console.error(err);
            showAlert("Đã có lỗi xảy ra khi hủy tài khoản", "error");
          }
        },
      );
    } else if (action === "reactivate") {
      showConfirm(
        "Kích hoạt tài khoản",
        `Bạn có chắc chắn muốn kích hoạt lại tài khoản cho giảng viên "${displayName}"?`,
        async () => {
          try {
            const res = await apiFetch(`users/${teacher.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: { id: 1 } }), // 1 = Active / Đã duyệt
            });

            if (res.ok) {
              showAlert(
                `Đã kích hoạt lại tài khoản giảng viên "${displayName}"`,
                "success",
              );
              fetchTeachers();
            } else {
              showAlert("Lỗi: " + (await readApiError(res)), "error");
            }
          } catch (err) {
            console.error(err);
            showAlert("Đã có lỗi xảy ra khi kích hoạt tài khoản", "error");
          }
        },
      );
    } else if (action === "temp_password") {
      showConfirm(
        "Cấp mật khẩu tạm thời",
        `Cấp mật khẩu tạm thời mới cho giảng viên "${displayName}" (${teacher.email || teacher.username})? Mật khẩu cũ sẽ bị thay thế ngay lập tức.`,
        async () => {
          try {
            const res = await apiFetch(`users/${teacher.id}/temp-password`, {
              method: "POST",
            });

            if (res.ok) {
              const data = await res.json();
              setTempPassModal({
                isOpen: true,
                email: teacher.email || teacher.username,
                tempPassword: data.tempPassword,
              });
            } else {
              showAlert(
                "Lỗi cấp mật khẩu: " + (await readApiError(res)),
                "error",
              );
            }
          } catch (err) {
            console.error(err);
            showAlert("Đã có lỗi xảy ra khi cấp mật khẩu", "error");
          }
        },
      );
    }
  };

  const getStatusDisplay = (teacher: TeacherRow) => {
    if (teacher.deletedAt) {
      return { text: "Đã xóa", color: "error" as const };
    }
    if (teacher.status?.id === 1) {
      return { text: "Đang hoạt động", color: "success" as const };
    }
    if (teacher.status?.id === 2) {
      return { text: "Đã hủy", color: "error" as const };
    }
    return { text: "Không rõ", color: "info" as const };
  };

  const getAvatarUrl = (photo?: TeacherPhoto | null) => {
    return resolveFileUrl(photo?.path, API_BASE_URL);
  };

  // Open Edit Teacher Modal
  const openEditModal = (teacher: TeacherRow) => {
    setEditingTeacherId(teacher.id);
    setEditEmail(teacher.email || teacher.username || "");
    setEditFullName(teacher.fullName || teacher.firstName || "");
    setEditPosition(teacher.position || "Bậc 1");
    setEditSelectedFile(null);
    setEditPreviewAvatar(getAvatarUrl(teacher.photo));
    setEditRemovePhoto(false);
    setIsEditModalOpen(true);
    setOpenDropdownId(null);
  };

  // Handle Edit Avatar File Change
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditSelectedFile(file);
      setEditPreviewAvatar(URL.createObjectURL(file));
      setEditRemovePhoto(false);
    }
  };

  // Submit Update Teacher
  const handleUpdateTeacher = async (
    e?: React.FormEvent | React.MouseEvent,
  ) => {
    if (e) e.preventDefault();
    if (!editingTeacherId) return;

    if (!editEmail.trim()) {
      showAlert("Vui lòng nhập email giảng viên", "warning");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail.trim())) {
      showAlert("Định dạng email không hợp lệ", "warning");
      return;
    }

    if (!editFullName.trim()) {
      showAlert("Vui lòng nhập họ và tên giảng viên", "warning");
      return;
    }

    setIsEditSubmitting(true);
    try {
      let photoId: string | undefined = undefined;

      // 1. Upload new photo if selected
      if (editSelectedFile) {
        const formData = new FormData();
        formData.append("file", editSelectedFile);
        const uploadRes = await apiFetch("files/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          photoId = uploadData.file?.id;
        } else {
          const errMsg = await readApiError(uploadRes);
          showAlert(`Tải ảnh đại diện thất bại: ${errMsg}`, "error");
          setIsEditSubmitting(false);
          return;
        }
      }

      // 2. Call PATCH users/:id
      const payload: {
        email: string;
        username: string;
        fullName: string;
        position: string;
        password?: string;
        photo?: { id: string } | null;
      } = {
        email: editEmail.trim(),
        username: editEmail.trim(),
        fullName: editFullName.trim(),
        position: editPosition,
      };

      if (photoId) {
        payload.photo = { id: photoId };
      } else if (editRemovePhoto) {
        payload.photo = null;
      }

      const res = await apiFetch(`users/${editingTeacherId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showAlert("Cập nhật thông tin giảng viên thành công!", "success");
        setIsEditModalOpen(false);
        fetchTeachers();
      } else {
        const errorMsg = await readApiError(res);
        showAlert(`Không thể cập nhật: ${errorMsg}`, "error");
      }
    } catch (err) {
      console.error("Failed to update teacher", err);
      showAlert("Đã có lỗi xảy ra khi cập nhật thông tin", "error");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  return (
    <>
      {/* Alert Notification */}
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

      {/* Main Card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        {/* Header & Controls */}
        <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Danh sách giảng viên
            </h3>

            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Thêm giảng viên
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Sort */}
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Sắp xếp (Mặc định)</option>
              <option value="name_asc">Tên giảng viên (A-Z)</option>
              <option value="email_asc">Email (A-Z)</option>
            </select>

            {/* Filter by Position: Chỉ bậc 1 và bậc 2 */}
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              value={filterPosition}
              onChange={(e) => {
                setFilterPosition(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả chức vụ</option>
              <option value="Bậc 1">Bậc 1</option>
              <option value="Bậc 2">Bậc 2</option>
            </select>

            {/* Filter by Status */}
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="1">Đang hoạt động</option>
              <option value="2">Đã hủy</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
              <TableRow>
                <TableCell
                  isHeader
                  className="w-36 min-w-[140px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Ảnh đại diện
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[240px] pl-10 pr-4 py-3.5 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Email giảng viên
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[180px] px-6 py-3.5 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Tên giảng viên
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[120px] px-6 py-3.5 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Chức vụ
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[130px] px-6 py-3.5 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Trạng thái
                </TableCell>
                <TableCell
                  isHeader
                  className="w-28 min-w-[110px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {teachers.map((teacher) => {
                const displayStatus = getStatusDisplay(teacher);
                const avatarSrc = getAvatarUrl(teacher.photo);
                const initial = (
                  teacher.fullName ||
                  teacher.email ||
                  teacher.username ||
                  "G"
                )
                  .charAt(0)
                  .toUpperCase();
                const isCanceled = teacher.status?.id === 2;

                return (
                  <TableRow key={teacher.id}>
                    {/* 1. Ảnh đại diện */}
                    <TableCell className="w-36 min-w-[140px] px-4 py-3 text-center">
                      <div className="flex justify-center items-center">
                        {avatarSrc ? (
                          <div className="relative w-10 h-10 overflow-hidden rounded-full border border-gray-200 dark:border-gray-700">
                            <Image
                              src={avatarSrc}
                              alt={teacher.email || teacher.username}
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                            {initial}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* 2. Email giảng viên */}
                    <TableCell className="min-w-[240px] pl-10 pr-4 py-3">
                      <span className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                        {teacher.email || teacher.username || "Chưa cập nhật"}
                      </span>
                    </TableCell>

                    {/* 3. Tên giảng viên */}
                    <TableCell className="min-w-[180px] px-6 py-3">
                      <span className="font-medium text-gray-700 text-theme-sm dark:text-gray-300">
                        {teacher.fullName ||
                          teacher.firstName ||
                          "Chưa cập nhật"}
                      </span>
                    </TableCell>

                    {/* 4. Chức vụ */}
                    <TableCell className="min-w-[120px] px-6 py-3">
                      <Badge size="sm" color="info">
                        {teacher.position || "Bậc 1"}
                      </Badge>
                    </TableCell>

                    {/* Trạng thái */}
                    <TableCell className="min-w-[130px] px-6 py-3">
                      <Badge size="sm" color={displayStatus.color}>
                        {displayStatus.text}
                      </Badge>
                    </TableCell>

                    {/* 5. Thao tác: CHỈ GỒM HỦY VÀ CẤP MẬT KHẨU TẠM THỜI */}
                    <TableCell className="w-28 min-w-[110px] px-4 py-3 text-center relative">
                      <button
                        onClick={() =>
                          setOpenDropdownId(
                            openDropdownId === teacher.id ? null : teacher.id,
                          )
                        }
                        className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
                        title="Thao tác"
                      >
                        <MoreDotIcon className="w-5 h-5" />
                      </button>

                      {openDropdownId === teacher.id && (
                        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1 z-20 transition-all duration-200">
                          {/* Thao tác 1: HỦY (hoặc Kích hoạt lại nếu đã hủy) */}
                          {isCanceled ? (
                            <button
                              onClick={() =>
                                handleAction(teacher, "reactivate")
                              }
                              className="text-success-600 hover:bg-success-50 p-2 rounded-full transition-colors"
                              title="Kích hoạt lại tài khoản"
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
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction(teacher, "cancel")}
                              className="text-error-500 hover:bg-error-50 p-2 rounded-full transition-colors"
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
                          )}

                          {/* Thao tác 2: CẤP MẬT KHẨU TẠM THỜI */}
                          <button
                            onClick={() =>
                              handleAction(teacher, "temp_password")
                            }
                            className="text-amber-600 hover:bg-amber-50 p-2 rounded-full transition-colors"
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

                          {/* Thao tác 3: THAY ĐỔI THÔNG TIN GIẢNG VIÊN */}
                          <button
                            onClick={() => openEditModal(teacher)}
                            className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-full transition-colors"
                            title="Thay đổi thông tin giảng viên"
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {teachers.length === 0 && !isLoading && (
                <TableRow>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <p>Không tìm thấy giảng viên nào.</p>
                    </div>
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
              Trước
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
                Trang{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {page}
                </span>
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

      {/* POPUP: THÊM GIẢNG VIÊN */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-[500px] p-6 sm:p-8"
      >
        <h3 className="mb-5 text-xl font-bold text-gray-800 dark:text-white/90">
          Thêm giảng viên mới
        </h3>

        <div className="flex flex-col gap-4">
          {/* 1. Ảnh đại diện */}
          <div>
            <Label>Ảnh đại diện</Label>
            <div className="flex items-center gap-4 mt-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-16 h-16 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:border-brand-500 overflow-hidden bg-gray-50 dark:bg-gray-800 group transition-all"
                title="Nhấp để tải ảnh lên"
              >
                {previewAvatar ? (
                  <Image
                    src={previewAvatar}
                    alt="Preview"
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-brand-500">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  Tải ảnh đại diện lên
                </button>
                {previewAvatar && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewAvatar(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-error-500 hover:underline text-left"
                  >
                    Xóa ảnh
                  </button>
                )}
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Hỗ trợ JPG, PNG, WEBP tối đa 5MB
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* 2. Email giảng viên (thay thế tên đăng nhập) */}
          <div>
            <Label>
              Email giảng viên <span className="text-error-500">*</span>
            </Label>
            <Input
              type="email"
              placeholder="Ví dụ: giangvien@gmail.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          {/* 3. Tên giảng viên */}
          <div>
            <Label>
              Tên giảng viên <span className="text-error-500">*</span>
            </Label>
            <Input
              type="text"
              placeholder="Ví dụ: Nguyễn Văn An"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
            />
          </div>

          {/* 4. Chức vụ (chỉ Bậc 1 và Bậc 2) */}
          <div>
            <Label>
              Chức vụ <span className="text-error-500">*</span>
            </Label>
            <select
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              <option value="Bậc 1">Bậc 1</option>
              <option value="Bậc 2">Bậc 2</option>
            </select>
          </div>

          {/* 5. Mật khẩu ban đầu có con mắt toggle */}
          <div>
            <Label>Mật khẩu ban đầu</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Mặc định: 123456"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeIcon className="fill-gray-500 dark:fill-gray-400 w-5 h-5" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 w-5 h-5" />
                )}
              </span>
            </div>
            <span className="text-xs text-gray-500 mt-1 block">
              Nếu để trống, mật khẩu mặc định là 123456
            </span>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateTeacher} disabled={isSubmitting}>
              {isSubmitting ? "Đang xử lý..." : "Lưu giảng viên"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMATION MODAL */}
      <Modal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        className="max-w-[420px] p-6"
      >
        <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
          {confirmDialog.title}
        </h3>
        <p className="mb-6 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
          {confirmDialog.message}
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() =>
              setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
            }
          >
            Đóng
          </Button>
          <Button
            onClick={() => {
              if (confirmDialog.onConfirm) confirmDialog.onConfirm();
              setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            }}
          >
            Đồng ý
          </Button>
        </div>
      </Modal>

      {/* TEMPORARY PASSWORD DISPLAY MODAL */}
      <Modal
        isOpen={tempPassModal.isOpen}
        onClose={() => setTempPassModal((prev) => ({ ...prev, isOpen: false }))}
        className="max-w-[450px] p-6"
      >
        <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
          Cấp mật khẩu tạm thời thành công
        </h3>
        <div className="mb-4">
          <Alert
            variant="success"
            title="Thành công"
            message={`Mật khẩu mới đã được tạo cho tài khoản: ${tempPassModal.email}`}
          />
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 mb-6">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Mật khẩu tạm thời mới:
            </span>
            <span className="text-xl font-mono font-bold text-brand-600 dark:text-brand-400 tracking-wider">
              {tempPassModal.tempPassword}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(tempPassModal.tempPassword);
              showAlert("Đã sao chép mật khẩu vào clipboard!", "success");
            }}
          >
            Sao chép
          </Button>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() =>
              setTempPassModal((prev) => ({ ...prev, isOpen: false }))
            }
          >
            Xong
          </Button>
        </div>
      </Modal>

      {/* 4. MODAL THAY ĐỔI THÔNG TIN GIẢNG VIÊN */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        className="max-w-[500px] p-6 sm:p-8"
      >
        <h3 className="mb-5 text-xl font-bold text-gray-800 dark:text-white/90">
          Thay đổi thông tin giảng viên
        </h3>

        <div className="flex flex-col gap-4">
          {/* 1. Ảnh đại diện */}
          <div>
            <Label>Ảnh đại diện</Label>
            <div className="flex items-center gap-4 mt-2">
              <div
                onClick={() => editFileInputRef.current?.click()}
                className="relative w-16 h-16 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:border-brand-500 overflow-hidden bg-gray-50 dark:bg-gray-800 group transition-all"
                title="Nhấp để tải ảnh lên"
              >
                {editPreviewAvatar ? (
                  <Image
                    src={editPreviewAvatar}
                    alt="Preview"
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-brand-500">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 text-left"
                >
                  Thay đổi ảnh đại diện
                </button>
                {editPreviewAvatar && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditSelectedFile(null);
                      setEditPreviewAvatar(null);
                      setEditRemovePhoto(true);
                      if (editFileInputRef.current)
                        editFileInputRef.current.value = "";
                    }}
                    className="text-xs text-error-500 hover:underline text-left"
                  >
                    Xóa ảnh
                  </button>
                )}
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Hỗ trợ JPG, PNG, WEBP tối đa 5MB
                </span>
              </div>

              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleEditFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* 2. Email giảng viên */}
          <div>
            <Label>
              Email giảng viên <span className="text-error-500">*</span>
            </Label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="nhap.email@tricehsk.edu.vn"
              className="mt-1"
            />
          </div>

          {/* 3. Tên giảng viên */}
          <div>
            <Label>
              Tên giảng viên <span className="text-error-500">*</span>
            </Label>
            <Input
              type="text"
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn A"
              className="mt-1"
            />
          </div>

          {/* 4. Chức vụ (Bậc 1, Bậc 2) */}
          <div>
            <Label>
              Chức vụ <span className="text-error-500">*</span>
            </Label>
            <select
              value={editPosition}
              onChange={(e) => setEditPosition(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-theme-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              <option value="Bậc 1">Bậc 1</option>
              <option value="Bậc 2">Bậc 2</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isEditSubmitting}
            >
              Hủy
            </Button>
            <Button onClick={handleUpdateTeacher} disabled={isEditSubmitting}>
              {isEditSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
