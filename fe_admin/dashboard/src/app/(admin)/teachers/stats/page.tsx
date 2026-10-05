import type { Metadata } from "next";
import React from "react";
import TeacherStats from "@/components/teachers/TeacherStats";

export const metadata: Metadata = {
  title: "Thống kê giảng viên | TRICE HSK",
  description: "Báo cáo và thống kê năng suất, cơ cấu chức vụ giảng viên TRICE HSK",
};

export default function TeacherStatsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TeacherStats />
    </div>
  );
}
