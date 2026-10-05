"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import Badge from "../ui/badge/Badge";
import { apiFetch } from "@/lib/api";
import {
  GroupIcon,
  DocsIcon,
  ShootingStarIcon,
  CheckCircleIcon,
  FolderIcon,
  TimeIcon,
  BellIcon,
} from "@/icons";

interface NotificationItem {
  id: string;
  type: "PENDING_STUDENT" | "QUESTION_ACTIVITY" | "EXAM_ACTIVITY" | "LEADERBOARD_STREAK" | "SYSTEM";
  title: string;
  message: string;
  time: string;
  timestamp: number;
  link: string;
  category: "PENDING" | "ACADEMIC" | "SYSTEM";
  badgeText: string;
  badgeColor: "warning" | "primary" | "success" | "info" | "error";
  isRead: boolean;
}

const STORAGE_KEY = "trice_hsk_read_notifications";

function formatRelativeTime(dateInput: string | Date | number): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (isNaN(diffSec) || diffSec < 60) return "Vừa xong";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 172800) return "Hôm qua";
  return `${Math.floor(diffSec / 86400)} ngày trước`;
}

export default function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "ACADEMIC">("ALL");
  const [isLoading, setIsLoading] = useState(false);

  // Load readIds from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setReadIds(JSON.parse(stored));
        }
      } catch {
        // Non-blocking
      }
    }
  }, []);

  // Fetch real notifications from pending students and audit logs
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const items: NotificationItem[] = [];

      // 1. Fetch pending students
      try {
        const filterStr = JSON.stringify({ statuses: [{ id: 3 }] });
        const resUsers = await apiFetch(`users?page=1&limit=4&filters=${encodeURIComponent(filterStr)}`);
        if (resUsers.ok) {
          const jsonUsers = await resUsers.json();
          const usersList = jsonUsers.data || [];
          usersList.forEach((u: any) => {
            const id = `pending-student-${u.id}`;
            const studentName = u.firstName || u.fullName || u.username || `HV-${u.studentCode || u.id}`;
            items.push({
              id,
              type: "PENDING_STUDENT",
              title: "Học viên chờ duyệt tài khoản",
              message: `${studentName} đăng ký cấp độ HSK ${u.currentHskLevel || 1} đang chờ Admin phê duyệt.`,
              time: formatRelativeTime(u.createdAt || Date.now()),
              timestamp: new Date(u.createdAt || Date.now()).getTime(),
              link: "/students/pending",
              category: "PENDING",
              badgeText: "Chờ duyệt",
              badgeColor: "warning",
              isRead: false,
            });
          });
        }
      } catch {
        // Pending users fetch failed gracefully
      }

      // 2. Fetch recent audit logs
      try {
        const resLogs = await apiFetch("audit-logs?page=1&limit=6");
        if (resLogs.ok) {
          const jsonLogs = await resLogs.json();
          const logsList = jsonLogs.data || [];
          logsList.forEach((log: any) => {
            const id = `audit-log-${log.id}`;
            let link = "/audit-logs";
            let badgeText = "Hoạt động";
            let type: NotificationItem["type"] = "SYSTEM";
            let category: NotificationItem["category"] = "ACADEMIC";
            let badgeColor: NotificationItem["badgeColor"] = "info";

            if (log.entityType === "QUESTION") {
              link = "/questions";
              badgeText = "Ngân hàng câu hỏi";
              type = "QUESTION_ACTIVITY";
            } else if (log.entityType === "EXAM") {
              link = "/exams";
              badgeText = "Đề thi HSK";
              type = "EXAM_ACTIVITY";
              badgeColor = "primary";
            } else if (log.entityType === "PRACTICE_SET") {
              link = "/data/topics";
              badgeText = "Học liệu";
              category = "ACADEMIC";
              badgeColor = "success";
            }

            items.push({
              id,
              type,
              title: log.action === "CREATE" ? "Hoạt động thêm mới" : log.action === "UPDATE" ? "Hoạt động cập nhật" : "Thay đổi hệ thống",
              message: log.summary || `${log.userName || "Admin"} thao tác trên ${log.entityType}`,
              time: formatRelativeTime(log.createdAt || Date.now()),
              timestamp: new Date(log.createdAt || Date.now()).getTime(),
              link,
              category,
              badgeText,
              badgeColor,
              isRead: false,
            });
          });
        }
      } catch {
        // Audit logs fetch failed gracefully
      }

      // Fallback highlights if fresh environment
      if (items.length === 0) {
        items.push({
          id: "sys-welcome",
          type: "SYSTEM",
          title: "Hệ thống Trice HSK sẵn sàng",
          message: "Chào mừng bạn đến với trung tâm điều hành quản trị Trice HSK.",
          time: "Vừa xong",
          timestamp: Date.now(),
          link: "/questions",
          category: "SYSTEM",
          badgeText: "Hệ thống",
          badgeColor: "success",
          isRead: false,
        });
      }

      // Sort newest first
      items.sort((a, b) => b.timestamp - a.timestamp);

      // Apply read status from state
      const updatedItems = items.map((item) => ({
        ...item,
        isRead: readIds.includes(item.id),
      }));

      setNotifications(updatedItems);
    } catch {
      // Non-blocking
    } finally {
      setIsLoading(false);
    }
  }, [readIds]);

  useEffect(() => {
    fetchNotifications();

    // Smart polling: refresh every 60s
    const timer = setInterval(() => {
      fetchNotifications();
    }, 60000);

    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // Unread Count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  // Filtered notifications by active tab
  const displayedNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeTab === "ALL") return true;
      if (activeTab === "PENDING") return item.category === "PENDING";
      if (activeTab === "ACADEMIC") return item.category === "ACADEMIC" || item.category === "SYSTEM";
      return true;
    });
  }, [notifications, activeTab]);

  // Mark all as read
  const handleMarkAllAsRead = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const allIds = notifications.map((n) => n.id);
    const newReadIds = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(newReadIds);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newReadIds));
    } catch {
      // Non-blocking
    }
  };

  // Click on a notification item
  const handleItemClick = (item: NotificationItem) => {
    if (!readIds.includes(item.id)) {
      const newReadIds = [...readIds, item.id];
      setReadIds(newReadIds);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newReadIds));
      } catch {
        // Non-blocking
      }
    }
    setIsOpen(false);
    router.push(item.link);
  };

  const renderIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "PENDING_STUDENT":
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-50 text-amber-500 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-800 dark:text-amber-400">
            <GroupIcon className="w-5 h-5" />
          </div>
        );
      case "QUESTION_ACTIVITY":
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-50 text-sky-500 border border-sky-200 dark:bg-sky-500/10 dark:border-sky-800 dark:text-sky-400">
            <DocsIcon className="w-5 h-5" />
          </div>
        );
      case "EXAM_ACTIVITY":
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 text-brand-500 border border-brand-200 dark:bg-brand-500/10 dark:border-brand-800 dark:text-brand-400">
            <FolderIcon className="w-5 h-5" />
          </div>
        );
      case "LEADERBOARD_STREAK":
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-800 dark:text-emerald-400">
            <ShootingStarIcon className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
            <CheckCircleIcon className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        type="button"
        aria-label="Thông báo"
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Pulsing indicator with badge count */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-theme-xs ring-2 ring-white dark:ring-gray-900">
            {unreadCount > 9 ? "9+" : unreadCount}
            <span className="absolute inline-flex w-full h-full bg-rose-400 rounded-full opacity-75 animate-ping"></span>
          </span>
        )}

        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {/* Dropdown Container */}
      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="absolute -right-16 sm:right-0 mt-3 flex h-[510px] w-[350px] sm:w-[390px] flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <h5 className="text-base font-bold text-gray-900 dark:text-white">
              Thông báo hệ thống
            </h5>
            {unreadCount > 0 ? (
              <Badge variant="light" color="error" size="sm">
                {unreadCount} mới
              </Badge>
            ) : (
              <Badge variant="light" color="success" size="sm">
                Đã xem hết
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline transition"
              >
                Đã đọc tất cả
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.7A1 1 0 005.7 7.12L10.59 12l-4.89 4.88a1 1 0 001.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mini Filter Tabs */}
        <div className="flex items-center gap-1.5 pt-2.5 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              activeTab === "ALL"
                ? "bg-brand-500 text-white shadow-theme-xs"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            Tất cả ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PENDING")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              activeTab === "PENDING"
                ? "bg-amber-500 text-white shadow-theme-xs"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            Chờ duyệt ({notifications.filter((n) => n.category === "PENDING").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ACADEMIC")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              activeTab === "ACADEMIC"
                ? "bg-sky-500 text-white shadow-theme-xs"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            Học thuật ({notifications.filter((n) => n.category === "ACADEMIC").length})
          </button>
        </div>

        {/* Notifications Scrollable List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
          {isLoading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="mt-2 text-xs">Đang kiểm tra thông báo...</span>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400 dark:text-gray-500">
              <CheckCircleIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-1" />
              <p className="text-xs font-medium">Không có thông báo nào trong mục này</p>
            </div>
          ) : (
            displayedNotifications.map((item) => {
              const isUnread = !readIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-start gap-3 p-3 rounded-xl transition cursor-pointer border ${
                    isUnread
                      ? "bg-brand-50/40 border-brand-100 dark:bg-brand-500/10 dark:border-brand-900/30"
                      : "bg-white border-transparent hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/40"
                  }`}
                >
                  {/* Icon Avatar */}
                  <div className="shrink-0 mt-0.5">{renderIcon(item.type)}</div>

                  {/* Body Content */}
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {item.title}
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0"></span>
                      )}
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-gray-400 font-medium">
                        {item.time}
                      </span>
                      <Badge variant="light" color={item.badgeColor} size="sm">
                        {item.badgeText}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-2 border-t border-gray-100 dark:border-gray-800 text-center">
          <Link
            href="/audit-logs"
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center justify-center w-full py-2 text-xs font-semibold text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 hover:text-brand-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white transition"
          >
            Xem toàn bộ nhật ký truy vết hệ thống →
          </Link>
        </div>
      </Dropdown>
    </div>
  );
}
