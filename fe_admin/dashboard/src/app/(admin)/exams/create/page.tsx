import React from "react";
import { Metadata } from "next";
import ExamCreateForm from "@/components/exams/ExamCreateForm";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Thêm đề thi mới | Trice HSK Admin",
  description: "Biên soạn đề thi chuẩn HSK từ cấp 1 đến cấp 9 theo format khảo thí quốc tế",
};

export default function ExamCreatePage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Thêm đề thi" />
      <ExamCreateForm />
    </div>
  );
}
