import React from "react";
import { Metadata } from "next";
import ExamList from "@/components/exams/ExamList";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Danh sách đề thi HSK | Trice HSK Admin",
  description: "Quản trị danh sách đề thi thử và bộ đề luyện tập chuẩn HSK từ cấp 1 đến cấp 9",
};

export default function ExamsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Danh sách đề thi" />
      <ExamList />
    </div>
  );
}
