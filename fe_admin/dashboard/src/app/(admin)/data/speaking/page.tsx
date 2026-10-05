import React, { Suspense } from "react";
import { Metadata } from "next";
import SkillDataManager from "@/components/data/SkillDataManager";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Quản lý dữ liệu Khẩu ngữ (Nói) | Trice HSK Admin",
  description: "Quản trị dữ liệu luyện phát âm, khẩu ngữ HSKK và bài tập giao tiếp AI theo chủ đề",
};

export default function SpeakingDataPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Quản lý dữ liệu - Nói" />
      <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Đang tải dữ liệu...</div>}>
        <SkillDataManager
          skill="SPEAKING"
          pageTitle="Quản lý dữ liệu Kỹ năng Nói (HSKK)"
          subtitle="Kho bài tập luyện khẩu ngữ, phát âm thanh điệu, giao tiếp nhập vai và tiêu chí đánh giá AI"
        />
      </Suspense>
    </div>
  );
}
