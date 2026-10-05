import React, { Suspense } from "react";
import { Metadata } from "next";
import SkillDataManager from "@/components/data/SkillDataManager";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Quản lý dữ liệu Nghe hiểu | Trice HSK Admin",
  description: "Quản trị học liệu luyện nghe HSK theo chủ đề, tệp âm thanh MP3 và bài tập nghe hiểu",
};

export default function ListeningDataPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Quản lý dữ liệu - Nghe" />
      <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Đang tải dữ liệu...</div>}>
        <SkillDataManager
          skill="LISTENING"
          pageTitle="Quản lý dữ liệu Kỹ năng Nghe hiểu"
          subtitle="Kho bài tập luyện nghe phân cấp HSK 1 - 9, tích hợp âm thanh MP3 và câu hỏi trắc nghiệm kiểm tra"
        />
      </Suspense>
    </div>
  );
}
