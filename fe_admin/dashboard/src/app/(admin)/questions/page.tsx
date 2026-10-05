import React from "react";
import { Metadata } from "next";
import QuestionList from "@/components/questions/QuestionList";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Ngân hàng câu hỏi HSK | Trice HSK Admin",
  description: "Quản trị ngân hàng câu hỏi HSK từ cấp 1 đến cấp 9, đa kỹ năng Nghe - Nói - Đọc - Viết",
};

export default function QuestionsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Ngân hàng câu hỏi" />
      <QuestionList />
    </div>
  );
}
