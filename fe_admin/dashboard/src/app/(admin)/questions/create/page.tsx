import React from "react";
import { Metadata } from "next";
import QuestionCreateForm from "@/components/questions/QuestionCreateForm";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Thêm câu hỏi mới | Trice HSK Admin",
  description: "Biên soạn và thêm mới câu hỏi vào ngân hàng đề thi chuẩn HSK 1 - 9",
};

export default function QuestionCreatePage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Thêm câu hỏi" />
      <QuestionCreateForm />
    </div>
  );
}
