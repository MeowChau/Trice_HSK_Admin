import type { Metadata } from "next";
import { EcommerceMetrics } from "@/components/ecommerce/EcommerceMetrics";
import React from "react";
import MonthlySalesChart from "@/components/ecommerce/MonthlySalesChart";
import StatisticsChart from "@/components/ecommerce/StatisticsChart";
import { HskLevelCharts } from "@/components/ecommerce/HskLevelCharts";
import RecentUsers from "@/components/ecommerce/RecentUsers";
import { DailyStudyTimeChart } from "@/components/ecommerce/DailyStudyTimeChart";

export const metadata: Metadata = {
  title:
    "Tổng quan | Hệ thống quản trị TriceHSK",
  description: "Trang tổng quan hệ thống quản trị TriceHSK",
};

export default function Ecommerce() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12">
        <StatisticsChart />
      </div>

      <div className="col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <HskLevelCharts />
        <DailyStudyTimeChart />
      </div>

      <div className="col-span-12 space-y-6"><MonthlySalesChart />      </div>

      <div className="col-span-12">
        <RecentUsers />
      </div>
    </div>
  );
}
