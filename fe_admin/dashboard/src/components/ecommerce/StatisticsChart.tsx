"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import flatpickr from "flatpickr";
import { Vietnamese } from "flatpickr/dist/l10n/vn";
import { CalenderIcon } from "../../icons";
import { apiFetch } from "@/lib/api";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function StatisticsChart() {
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!datePickerRef.current) return;

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);

    const fp = flatpickr(datePickerRef.current, {
      mode: "range",
      locale: {
        ...Vietnamese,
        months: {
          ...Vietnamese.months,
          longhand: [
            "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
            "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
          ],
        },
        rangeSeparator: " - ",
      },
      position: "auto right",
      monthSelectorType: "static",
      dateFormat: "d/m/Y",
      ariaDateFormat: "d/m/Y",
      defaultDate: [sevenDaysAgo, today],
      clickOpens: true,
      onReady: (_dates, _value, instance) => {
        instance.calendarContainer.classList.add("statistics-calendar");
      },
      prevArrow:
        '<svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 15L7.5 10L12.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      nextArrow:
        '<svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 15L12.5 10L7.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    });

    return () => {
      if (!Array.isArray(fp)) {
        fp.destroy();
      }
    };
  }, []);

  const [apiData, setApiData] = useState<{ newUsers: number[], newTeachers: number[], startMonth: number }>({
    newUsers: [0, 0, 0, 0, 0, 0],
    newTeachers: [0, 0, 0, 0, 0, 0],
    startMonth: (new Date().getMonth() + 1) <= 6 ? 1 : 7,
  });

  const [selectedRole, setSelectedRole] = useState<"student" | "teacher">("student");

  const getButtonClass = (role: "student" | "teacher") =>
    selectedRole === role
      ? "shadow-theme-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800"
      : "text-gray-500 dark:text-gray-400";

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        const res = await apiFetch('analytics/registrations');
        if (res.ok) {
          const data = await res.json();
          if (data.newUsers && data.newTeachers && data.startMonth) {
            setApiData(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch registrations", err);
      }
    };
    fetchRegistrations();
  }, []);

  const options: ApexOptions = {
    legend: {
      show: false, // Hide legend
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#465FFF", "#9CB9FF"], // Define line colors
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 310,
      type: "line", // Set the chart type to 'line'
      toolbar: {
        show: false, // Hide chart toolbar
      },
    },
    stroke: {
      curve: "straight", // Define the line style (straight, smooth, or step)
      width: [2, 2], // Line width for each dataset
    },

    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
      },
    },
    markers: {
      size: 0, // Size of the marker points
      strokeColors: "#fff", // Marker border color
      strokeWidth: 2,
      hover: {
        size: 6, // Marker size on hover
      },
    },
    grid: {
      xaxis: {
        lines: {
          show: false, // Hide grid lines on x-axis
        },
      },
      yaxis: {
        lines: {
          show: true, // Show grid lines on y-axis
        },
      },
    },
    dataLabels: {
      enabled: false, // Disable data labels
    },
    tooltip: {
      enabled: true, // Enable tooltip
      x: {
        format: "dd MMM yyyy", // Format for x-axis tooltip
      },
    },
    xaxis: {
      type: "category", // Category-based x-axis
      categories: Array.from({ length: 6 }, (_, i) => `Th ${apiData.startMonth + i}`),
      axisBorder: {
        show: false, // Hide x-axis border
      },
      axisTicks: {
        show: false, // Hide x-axis ticks
      },
      tooltip: {
        enabled: false, // Disable tooltip for x-axis points
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px", // Adjust font size for y-axis labels
          colors: ["#6B7280"], // Color of the labels
        },
      },
      title: {
        text: "", // Remove y-axis title
        style: {
          fontSize: "0px",
        },
      },
    },
  };

  const series = [
    {
      name: selectedRole === "student" ? "Người dùng mới" : "Giáo viên mới",
      data: selectedRole === "student" ? apiData.newUsers : apiData.newTeachers,
    }
  ];
  return (
    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Thống kê
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Số lượng người dùng mới (tháng {apiData.startMonth} - tháng {apiData.startMonth + 5})
          </p>
        </div>
        <div className="flex w-full max-w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900">
            <button
              type="button"
              aria-pressed={selectedRole === "student"}
              onClick={() => setSelectedRole("student")}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-theme-sm font-medium hover:text-gray-900 dark:hover:text-white ${getButtonClass("student")}`}
            >
              Người dùng
            </button>
            <button
              type="button"
              aria-pressed={selectedRole === "teacher"}
              onClick={() => setSelectedRole("teacher")}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-theme-sm font-medium hover:text-gray-900 dark:hover:text-white ${getButtonClass("teacher")}`}
            >
              Giáo viên
            </button>
          </div>
          <div className="relative w-full sm:w-[17rem] sm:shrink-0">
            <CalenderIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-5 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            <input
              ref={datePickerRef}
              aria-label="Chọn khoảng ngày thống kê"
              className="h-10 w-full cursor-pointer rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm font-medium text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              placeholder="Chọn khoảng ngày"
            />
          </div>
        </div>
      </div>

      <div className="w-full min-w-0">
        <Chart options={options} series={series} type="area" height={310} width="100%" />
      </div>
    </div>
  );
}
