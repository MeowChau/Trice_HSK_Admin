import type { Metadata } from "next";
import React from "react";
import AuditLogsTable from "@/components/audit-logs/AuditLogsTable";

export const metadata: Metadata = {
  title: "Truy vết chỉnh sửa (Audit Logs) | TRICE HSK Admin",
  description: "Lịch sử chi tiết các thao tác chỉnh sửa, thay đổi dữ liệu của Admin và Giảng viên",
};

export default function AuditLogsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AuditLogsTable />
    </div>
  );
}
