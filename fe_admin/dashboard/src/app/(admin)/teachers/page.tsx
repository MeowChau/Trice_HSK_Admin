import type { Metadata } from "next";
import React from "react";
import TeacherList from "@/components/teachers/TeacherList";

export const metadata: Metadata = {
  title: "Danh sách giảng viên | TRICE HSK",
  description: "Quản lý danh sách giảng viên TRICE HSK",
};

export default function TeachersPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TeacherList />
    </div>
  );
}
