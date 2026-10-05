import React, { Suspense } from "react";
import { Metadata } from "next";
import VocabularyList from "@/components/data/VocabularyList";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Quản lý từ vựng HSK & Bám sát giáo trình | Trice HSK Admin",
  description: "Quản lý danh mục từ vựng HSK 1 - 9, gán và phân loại từ vựng bám sát các bài học sách giáo trình",
};

export default function VocabularyPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Quản lý từ vựng theo bài học" />
      <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400">Đang tải trang từ vựng...</div>}>
        <VocabularyList />
      </Suspense>
    </div>
  );
}
