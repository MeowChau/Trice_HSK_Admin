import React from "react";
import { Metadata } from "next";
import TopicList from "@/components/data/TopicList";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export const metadata: Metadata = {
  title: "Quản lý chủ đề học thuật HSK | Trice HSK Admin",
  description: "Quản trị danh mục chủ đề theo lộ trình HSK 1 - 9 phân bổ 4 kỹ năng Nghe - Nói - Đọc - Viết",
};

export default function TopicsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Các chủ đề học thuật" />
      <TopicList />
    </div>
  );
}
