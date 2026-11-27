"use client";
import { useCallback, useEffect, useState } from "react";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";

type MonthlyExams = { year: number; monthlyCounts: number[]; total: number };

// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function MonthlySalesChart() {
  const [year] = useState(() =>
    Number(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
      }).format(new Date()),
    ),
  );
  const [data, setData] = useState<MonthlyExams | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requests = useLatestRequest();
  const load = useCallback(async () => {
    const request = requests.start();
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`analytics/monthly-exams?year=${year}`, {
        signal: request.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("monthlyExamsUnavailable");
      const result: MonthlyExams = await response.json();
      if (
        result.year !== year ||
        !Array.isArray(result.monthlyCounts) ||
        result.monthlyCounts.length !== 12 ||
        !result.monthlyCounts.every(
          (count) => Number.isSafeInteger(count) && count >= 0,
        ) ||
        result.total !==
          result.monthlyCounts.reduce((sum, count) => sum + count, 0)
      ) {
        throw new Error("monthlyExamsInvalid");
      }
      if (request.isCurrent()) setData(result);
    } catch {
      if (request.isCurrent())
        setError("Không tải được số lượng đề thi. Vui lòng thử lại.");
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [year, requests]);
  useEffect(() => {
    void load();
    return () => requests.cancel();
  }, [load, requests]);

  const maxCount = Math.max(0, ...(data?.monthlyCounts ?? []));
  const stepSize = Math.max(1, Math.ceil(maxCount / 5));
  const options: ApexOptions = {
    colors: ["#465fff"],
    chart: {
      fontFamily: "Inter, sans-serif",
      type: "bar",
      height: 180,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "39%",
        borderRadius: 0,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: false,
      width: 0,
    },
    xaxis: {
      categories: [
        "Th 1",
        "Th 2",
        "Th 3",
        "Th 4",
        "Th 5",
        "Th 6",
        "Th 7",
        "Th 8",
        "Th 9",
        "Th 10",
        "Th 11",
        "Th 12",
      ],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    responsive: [{
      breakpoint: 640,
      options: { xaxis: { labels: { rotate: -60, rotateAlways: true } } },
    }],
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Inter, sans-serif",
    },
    yaxis: {
      min: 0,
      max: Math.max(1, Math.ceil(maxCount / stepSize)) * stepSize,
      stepSize,
      decimalsInFloat: 0,
      title: {
        text: undefined,
      },
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },

    tooltip: {
      x: {
        show: false,
      },
      y: {
        formatter: (val: number) => `${val} đề thi`,
      },
    },
  };
  const series = [
    {
      name: "Đề thi",
      data: data?.monthlyCounts.map((count) => count === 0 ? null : count) ?? [],
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Số lượng đề thi hàng tháng
        </h3>
      </div>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        Năm {year}
        {data && !loading && !error ? ` · Tổng ${data.total} đề thi` : ""}
      </p>

      <div
        aria-busy={loading}
        aria-label={`Số đề thi được tạo theo tháng trong năm ${year}`}
      >
        {loading ? (
          <p
            role="status"
            className="flex h-[180px] items-center justify-center text-sm text-gray-500 dark:text-gray-400"
          >
            Đang tải biểu đồ…
          </p>
        ) : error ? (
          <div className="py-5">
            <Alert
              variant="error"
              title="Chưa tải được thống kê đề thi"
              message={error}
            />
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Thử lại
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full min-w-0">
              <ReactApexChart
                options={options}
                series={series}
                type="bar"
                height={180}
                width="100%"
              />
            </div>
            {data?.total === 0 && (
              <p
                role="status"
                className="pb-4 text-sm text-gray-500 dark:text-gray-400"
              >
                Chưa có đề thi được tạo trong năm {year}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
