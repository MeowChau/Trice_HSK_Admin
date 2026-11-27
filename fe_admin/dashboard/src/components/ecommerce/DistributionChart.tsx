"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
const colors = [
  "#465FFF", "#9CB9FF", "#FF7F5C", "#FFD700", "#FF69B4",
  "#8A2BE2", "#20B2AA", "#FFA07A", "#778899",
];

type Props = {
  id: string;
  title: string;
  labels: string[];
  series: number[] | null;
  error: boolean;
};

export default function DistributionChart({ id, title, labels, series, error }: Props) {
  const options: ApexOptions = {
    chart: {
      id,
      type: "pie",
      fontFamily: "Inter, sans-serif",
      // Avoid animating a stale, empty initial pie while API data is loading.
      animations: { enabled: false },
      redrawOnParentResize: true,
      redrawOnWindowResize: true,
    },
    labels,
    colors,
    grid: { padding: { top: 12, right: 12, bottom: 12, left: 12 } },
    plotOptions: { pie: { customScale: 0.9, expandOnClick: false, dataLabels: { offset: -12 } } },
    legend: { position: "bottom", fontSize: "12px" },
    dataLabels: {
      enabled: true,
      formatter: (_value, options) => options.w.config.series[options.seriesIndex],
      style: { colors: ["#FFFFFF"], fontSize: "12px", fontWeight: 700 },
      dropShadow: { enabled: false },
    },
    tooltip: { y: { formatter: (value) => `${value} người` } },
  };

  return (
    <div className="distribution-chart min-w-0 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <h3 className="mb-4 w-full text-center text-lg font-semibold text-gray-800 dark:text-white/90">
        {title}
      </h3>
      <div className="min-h-[320px] w-full min-w-0">
        {error ? (
          <p role="alert" className="flex h-80 items-center justify-center text-center text-sm text-error-500">
            Không tải được dữ liệu biểu đồ. Vui lòng tải lại trang.
          </p>
        ) : series === null ? (
          <p role="status" className="flex h-80 items-center justify-center text-sm text-gray-500">
            Đang tải dữ liệu…
          </p>
        ) : !series.some((value) => value > 0) ? (
          <p className="flex h-80 items-center justify-center text-sm text-gray-500">
            Chưa có dữ liệu
          </p>
        ) : (
          // Mount with real data rather than updating a zero/placeholder pie
          // while ApexCharts is still rendering its initial series.
          <Chart options={options} series={series} type="pie" height={320} width="100%" />
        )}
      </div>
    </div>
  );
}
