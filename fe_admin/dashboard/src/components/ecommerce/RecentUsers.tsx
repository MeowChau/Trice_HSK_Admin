"use client";

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

export default function RecentUsers() {
  const requests = useLatestRequest();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<string>("");

  useEffect(() => {
    const request = requests.start();
    const filters: UserFilters = {
      roles: [{ id: 2 }],
      ...(filterLevel ? { currentHskLevel: Number(filterLevel) } : {}),
    };
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      filters: JSON.stringify(filters),
    });
    if (sortBy === "name_asc")
      query.set(
        "sort",
        JSON.stringify([{ orderBy: "firstName", order: "ASC" }]),
      );
    else if (sortBy === "id_asc")
      query.set(
        "sort",
        JSON.stringify([{ orderBy: "studentCode", order: "ASC" }]),
      );
    void apiFetch(`users?${query}`, { signal: request.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{
          data: UserRow[];
          hasNextPage: boolean;
        }>;
      })
      .then((data) => {
        if (request.isCurrent()) setUsers(data.data);
      })
      .catch((error) => {
        if (request.isCurrent()) console.error("Failed to fetch users", error);
      });
    return () => requests.cancel();
  }, [requests, page, limit, sortBy, filterLevel]);

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
    return { text: "Không xác định", color: "light" as const };
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Người dùng gần đây
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
            <option value="">Tất cả trình độ</option>
            <option value="1">Trình độ 1</option>
            <option value="2">Trình độ 2</option>
            <option value="3">Trình độ 3</option>
            <option value="4">Trình độ 4</option>
            <option value="5">Trình độ 5</option>
            <option value="6">Trình độ 6</option>
            <option value="7">Trình độ 7</option>
            <option value="8">Trình độ 8</option>
            <option value="9">Trình độ 9</option>
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
                    {user.currentHskLevel ? `HSK ${user.currentHskLevel}` : "-"}
                  </TableCell>
                  <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    <Badge size="sm" color={displayStatus.color}>
                      {displayStatus.text}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}

            {users.length === 0 && (
              <TableRow>
                <td
                  colSpan={4}
                  className="py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  Không tìm thấy người dùng nào.
                </td>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
