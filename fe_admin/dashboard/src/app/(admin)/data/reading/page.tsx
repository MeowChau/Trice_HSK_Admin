import React, { Suspense } from "react";
import { Metadata } from "next";
import SkillDataManager from "@/components/data/SkillDataManager";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Quản lý dữ liệu Đọc hiểu | Trice HSK Admin",
  description: "Quản trị kho bài đọc hiểu, đoạn văn và câu hỏi đọc hiểu chuẩn HSK 1 - 9 theo chủ đề",
};

export default function ReadingDataPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Quản lý dữ liệu - Đọc" />
      <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Đang tải dữ liệu...</div>}>
        <SkillDataManager
          skill="READING"
          pageTitle="Quản lý dữ liệu Kỹ năng Đọc hiểu"
          subtitle="Kho bài khóa, đoạn văn đọc hiểu phân cấp độ HSK 1 - 9, tích hợp bài tập tra cứu từ vựng và câu hỏi"
        />
      </Suspense>
    </div>
  );
}
