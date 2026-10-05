import type { Metadata } from "next";
import React from "react";
import StudentList from "../../../components/students/StudentList";

export const metadata: Metadata = {
  title: "Danh sách tài khoản | TRICE HSK",
  description:
    "Danh sách tài khoản học viên TRICE HSK",
};

export default function StudentsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <StudentList />
    </div>
  );
}