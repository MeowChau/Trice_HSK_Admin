"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import flatpickr from "flatpickr";
import { Vietnamese } from "flatpickr/dist/l10n/vn";
import { CalenderIcon } from "../../icons";
import { apiFetch } from "@/lib/api";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type RegistrationRange = { from: string; to: string };
type RegistrationData = {
  startMonth: number;
  endMonth: number;
  from?: string;
  to?: string;
  dates?: string[];
  newUsers: number[];
  newTeachers: number[];
};

const displayDate = (date: string) => date.split("-").reverse().join("/");

export default function StatisticsChart() {
  const picker = useRef<flatpickr.Instance | null>(null);
  const pickerDates = useRef<Date[]>([]);
  const [range, setRange] = useState<RegistrationRange | null>(null);
  const [apiData, setApiData] = useState<RegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const requests = useLatestRequest();

  const attachDatePicker = useCallback((input: HTMLInputElement | null) => {
    const previous = picker.current;
    picker.current = null;
    previous?.destroy();
    if (!input) return;

    // Keep the React-owned input in place. Flatpickr's static wrapper moves it
    // to another parent, which makes remounts and hot updates fragile.
    picker.current = flatpickr(input, {
      mode: "range",
      locale: {
        ...Vietnamese,
        months: {
          ...Vietnamese.months,
          longhand: [
            "Tháng 1",
            "Tháng 2",
            "Tháng 3",
            "Tháng 4",
            "Tháng 5",
            "Tháng 6",
            "Tháng 7",
            "Tháng 8",
            "Tháng 9",
            "Tháng 10",
            "Tháng 11",
            "Tháng 12",
          ],
        },
        rangeSeparator: " - ",
      },
      position: "auto right",
      monthSelectorType: "static",
      dateFormat: "d/m/Y",
      ariaDateFormat: "d/m/Y",
      disableMobile: true,
      defaultDate: pickerDates.current,
      clickOpens: true,
      onReady: (_dates, _value, instance) => {
        instance.calendarContainer.classList.add("statistics-calendar");
      },
      onChange: (dates, _dateString, instance) => {
        pickerDates.current = dates.map((date) => new Date(date.getTime()));
        if (dates.length === 0) {
          setDateError("");
          setRange(null);
          return;
        }
        if (dates.length !== 2) {
          setDateError("Chọn thêm ngày kết thúc để cập nhật biểu đồ.");
          return;
        }
        const from = instance.formatDate(dates[0], "Y-m-d");
        const to = instance.formatDate(dates[1], "Y-m-d");
        if ((Date.parse(to) - Date.parse(from)) / 86400000 + 1 > 366) {
          setDateError(
            "Mỗi lần xem tối đa 366 ngày. Vui lòng thu hẹp khoảng thời gian.",
          );
          return;
        }
        setDateError("");
        setRange((current) =>
          current?.from === from && current?.to === to ? current : { from, to },
        );
      },
      prevArrow:
        '<svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 15L7.5 10L12.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      nextArrow:
        '<svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 15L12.5 10L7.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    });
  }, []);

  const openDatePicker = (input: HTMLInputElement) => {
    if (!picker.current?.config || picker.current.input !== input) {
      attachDatePicker(input);
    }
    picker.current?.open();
  };

  const [selectedRole, setSelectedRole] = useState<"student" | "teacher">(
    "student",
  );

  const getButtonClass = (role: "student" | "teacher") =>
    selectedRole === role
      ? "shadow-theme-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800"
      : "text-gray-500 dark:text-gray-400";

  const load = useCallback(async () => {
    const request = requests.start();
    setLoading(true);
    setError("");
    setApiData(null);
    try {
      const query = range ? `?${new URLSearchParams(range)}` : "";
      const response = await apiFetch(`analytics/registrations${query}`, {
        signal: request.signal,
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Không tải được thống kê. Vui lòng thử lại.");
      const data: RegistrationData = await response.json();
      const validSeries =
        Array.isArray(data.newUsers) && Array.isArray(data.newTeachers);
      const validPeriod = range
        ? data.from === range.from &&
          data.to === range.to &&
          Array.isArray(data.dates) &&
          data.dates.length === data.newUsers?.length &&
          data.dates.length === data.newTeachers?.length
        : [1, 7].includes(data.startMonth) &&
          data.endMonth === data.startMonth + 5 &&
          data.newUsers?.length === 6 &&
          data.newTeachers?.length === 6;
      if (!validSeries || !validPeriod) {
        throw new Error("Dữ liệu thống kê không khớp khoảng ngày đã chọn.");
      }
      if (request.isCurrent()) setApiData(data);
    } catch {
      if (request.isCurrent())
        setError("Không tải được thống kê. Vui lòng thử lại.");
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [range, requests]);

  useEffect(() => {
    void load();
    return () => requests.cancel();
  }, [load, requests]);

  const categories = apiData
    ? range
      ? (apiData.dates?.map(displayDate) ?? [])
      : Array.from(
          { length: 6 },
          (_, index) => `Th ${apiData.startMonth + index}`,
        )
    : [];
  const periodLabel = range
    ? `${displayDate(range.from)} – ${displayDate(range.to)}`
    : apiData
      ? `tháng ${apiData.startMonth} – tháng ${apiData.endMonth}`
      : "6 tháng hiện tại";

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
        formatter: (value) => String(value),
      },
    },
    xaxis: {
      type: "category", // Category-based x-axis
      categories,
      tickAmount: Math.min(Math.max(categories.length - 1, 1), 8),
      labels: { hideOverlappingLabels: true },
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
      min: 0,
      decimalsInFloat: 0,
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
      data:
        (selectedRole === "student"
          ? apiData?.newUsers
          : apiData?.newTeachers) ?? [],
    },
  ];
  return (
    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Thống kê
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Số lượng {selectedRole === "student" ? "người dùng" : "giáo viên"}{" "}
            mới ({periodLabel})
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
          <div
            className="inline-flex h-10 w-full shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 focus-within:border-brand-500 dark:border-gray-700 dark:bg-gray-800 sm:w-[17rem]"
            onClick={() => picker.current?.open()}
          >
            <CalenderIcon
              className="pointer-events-none block size-5 shrink-0 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <input
              ref={attachDatePicker}
              readOnly
              aria-haspopup="dialog"
              onClick={(event) => openDatePicker(event.currentTarget)}
              onFocus={(event) => openDatePicker(event.currentTarget)}
              aria-label="Khoảng ngày thống kê đăng ký"
              aria-describedby={
                dateError ? "registration-date-error" : undefined
              }
              aria-invalid={!!dateError}
              title={
                range
                  ? `${displayDate(range.from)} – ${displayDate(range.to)}`
                  : "Chọn khoảng ngày"
              }
              className="h-full w-0 min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-sm font-medium leading-5 text-gray-700 outline-none ring-0 focus:ring-0 dark:text-gray-300"
              placeholder="Chọn ngày"
            />
            {(range || dateError) && (
              <button
                type="button"
                aria-label="Xóa khoảng ngày đã chọn"
                title="Xóa khoảng ngày đã chọn"
                className="inline-flex h-full w-5 shrink-0 items-center justify-center rounded-md border-0 p-0 leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  picker.current?.clear();
                  picker.current?.close();
                  setRange(null);
                  setDateError("");
                }}
              >
                <span
                  className="relative block size-3 before:absolute before:inset-0 before:m-auto before:h-px before:w-3 before:rotate-45 before:bg-current before:content-[''] after:absolute after:inset-0 after:m-auto after:h-px after:w-3 after:-rotate-45 after:bg-current after:content-['']"
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {dateError && (
        <p
          id="registration-date-error"
          role="alert"
          className="mb-3 text-sm text-error-500"
        >
          {dateError}
        </p>
      )}
      <div
        className="w-full min-w-0"
        aria-busy={loading}
        aria-label={
          range ? "Biểu đồ đăng ký theo ngày" : "Biểu đồ đăng ký theo tháng"
        }
      >
        {loading ? (
          <p
            role="status"
            className="flex h-[310px] items-center justify-center text-sm text-gray-500 dark:text-gray-400"
          >
            Đang tải biểu đồ…
          </p>
        ) : error ? (
          <div className="min-h-[310px]">
            <Alert
              variant="error"
              title="Chưa tải được thống kê"
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
            <Chart
              options={options}
              series={series}
              type="area"
              height={310}
              width="100%"
            />
            {!series[0].data.some((count) => count > 0) && (
              <p
                role="status"
                className="mt-2 text-sm text-gray-500 dark:text-gray-400"
              >
                Không có{" "}
                {selectedRole === "student" ? "người dùng" : "giáo viên"} đăng
                ký mới trong {range ? "khoảng ngày đã chọn" : "6 tháng này"}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
