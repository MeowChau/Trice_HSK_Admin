"use client";
import { useCallback } from "react";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import type { UserFilters } from "@/lib/api-types";

import React, { useEffect, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

import Badge from "../ui/badge/Badge";
import { apiFetch } from "@/lib/api";

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

export default function PendingPendingStudentList() {
  const requests = useLatestRequest();

  const [users, setUsers] = useState<UserRow[]>([]);

  const [page, setPage] = useState(1);

  const [limit] = useState(10);

  const [sortBy, setSortBy] = useState<string>("");

  const [filterLevel, setFilterLevel] = useState<string>("");

  const [hasNextPage, setHasNextPage] = useState(false);

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

  const fetchUsers = useCallback(async () => {
    const request = requests.start();

    try {
      let queryUrl = `users?page=${page}&limit=${limit}`;

      // Default filter to only show normal users (role id 2) instead of Admins
      const filtersObj: UserFilters = {
        roles: [{ id: 2 }],
        statuses: [{ id: 3 }],
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
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Học viên chờ duyệt
            </h3>
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
                      {user.studentCode ? `#${user.studentCode}` : ""}
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

                    <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => updateStatus(user.id, 1)}
                          className="text-green-500 hover:text-green-700 hover:bg-green-50 p-1.5 rounded-full transition-colors"
                          title="Duyệt"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
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
                        <button
                          onClick={() => updateStatus(user.id, 2)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                          title="Hủy"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
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
    </>
  );
}
