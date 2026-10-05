import React, { Suspense } from "react";
import { Metadata } from "next";
import SkillDataManager from "@/components/data/SkillDataManager";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Quản lý dữ liệu Luyện viết | Trice HSK Admin",
  description: "Quản trị dữ liệu nét chữ Hán, bộ thủ, sắp xếp câu và viết đoạn văn theo chuẩn HSK",
};

export default function WritingDataPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Quản lý dữ liệu - Viết" />
      <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Đang tải dữ liệu...</div>}>
        <SkillDataManager
          skill="WRITING"
          pageTitle="Quản lý dữ liệu Kỹ năng Viết"
          subtitle="Kho bài tập luyện nét chữ Hán, sắp xếp câu hoàn chỉnh và viết đoạn văn theo tranh minh họa"
        />
      </Suspense>
    </div>
  );
}
