"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Pagination from "@/components/tables/Pagination";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { useTheme } from "@/context/ThemeContext";
import { apiFetch, readApiError } from "@/lib/api";
import { errorMessage } from "@/lib/error-message";
import { CheckCircleIcon, DollarLineIcon, GroupIcon, TimeIcon } from "@/icons";
import {
  defaultRevenueFilters,
  PAYMENT_STATUS_LABELS,
  revenueDateError,
  revenueDay,
  revenueMoney,
  revenuePath,
  revenueTime,
} from "@/lib/revenue";
import type { PaymentStatus, RevenueData, RevenueQuery } from "@/lib/revenue";

const RevenueChart = dynamic(() => import("react-apexcharts"), { ssr: false });
const control =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";
const cell = "px-5 py-4 text-sm text-gray-600 dark:text-gray-300";
const headingCell =
  "whitespace-nowrap px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400";
const statusColor: Record<
  PaymentStatus,
  "success" | "warning" | "error" | "light" | "info"
> = {
  paid: "success",
  pending: "warning",
  creating: "info",
  cancelled: "error",
  expired: "light",
};

export default function RevenueDashboard() {
  const [filters, setFilters] = useState(defaultRevenueFilters);
  const [query, setQuery] = useState<RevenueQuery>(() => ({
    ...defaultRevenueFilters(),
    page: 1,
    limit: 20,
  }));
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const requests = useLatestRequest();
  const { theme } = useTheme();

  const load = useCallback(async () => {
    const request = requests.start();
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(revenuePath(query), {
        signal: request.signal,
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? "Chỉ quản trị viên được xem doanh thu thanh toán."
            : await readApiError(response),
        );
      const result: RevenueData = await response.json();
      if (
        !result.summary ||
        !Array.isArray(result.transactions) ||
        !Array.isArray(result.chart) ||
        !Array.isArray(result.topExams)
      )
        throw new Error(
          "Dữ liệu doanh thu chưa đúng định dạng. Vui lòng kiểm tra phiên bản backend.",
        );
      if (request.isCurrent()) setData(result);
    } catch (cause) {
      if (request.isCurrent())
        setError(
          errorMessage(
            cause,
            "Không tải được báo cáo doanh thu. Vui lòng thử lại.",
          ),
        );
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [query, requests]);
  useEffect(() => {
    void load();
  }, [load]);

  const chartOptions = useMemo<ApexOptions>(
    () => ({
      colors: ["#465fff"],
      chart: {
        type: "area",
        fontFamily: "Outfit, sans-serif",
        toolbar: { show: false },
        zoom: { enabled: false },
        background: "transparent",
        animations: { enabled: false },
      },
      theme: { mode: theme },
      dataLabels: { enabled: false },
      stroke: { curve: "straight", width: 2 },
      fill: {
        type: "gradient",
        gradient: { opacityFrom: 0.25, opacityTo: 0.02 },
      },
      grid: { borderColor: theme === "dark" ? "#344054" : "#e4e7ec" },
      xaxis: {
        type: "datetime",
        labels: {
          datetimeUTC: false,
          format: "dd/MM",
          hideOverlappingLabels: true,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        min: 0,
        labels: {
          formatter: (value) =>
            new Intl.NumberFormat("vi-VN", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(value) + " đ",
        },
      },
      tooltip: {
        theme,
        x: { format: "dd/MM/yyyy" },
        y: { formatter: revenueMoney },
      },
      markers: { size: data?.chart.length === 1 ? 5 : 0 },
    }),
    [theme, data?.chart.length],
  );
  const series = useMemo(
    () => [
      {
        name: "Doanh thu",
        data: (data?.chart || []).map((day) => ({
          x: Date.parse(day.date + "T12:00:00+07:00"),
          y: day.revenue,
        })),
      },
    ],
    [data?.chart],
  );

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = revenueDateError(filters.from, filters.to);
    setDateError(message || "");
    if (message) return;
    setQuery({ ...filters, search: filters.search.trim(), page: 1, limit: 20 });
  }
  function reset() {
    const next = defaultRevenueFilters();
    setFilters(next);
    setDateError("");
    setQuery({ ...next, page: 1, limit: 20 });
  }
  const metrics = [
    {
      label: "Doanh thu đã xác nhận",
      value: data ? revenueMoney(data.summary.totalRevenue) : "—",
      hint: "Chỉ tính đơn đã thanh toán",
      icon: <DollarLineIcon />,
    },
    {
      label: "Đơn đã thanh toán",
      value: data?.summary.paidOrders.toLocaleString("vi-VN") ?? "—",
      hint: data
        ? "Trung bình " + revenueMoney(data.summary.averageOrderValue) + "/đơn"
        : "—",
      icon: <CheckCircleIcon />,
    },
    {
      label: "Khách hàng đã mua",
      value: data?.summary.payingCustomers.toLocaleString("vi-VN") ?? "—",
      hint: "Khách hàng không trùng lặp",
      icon: <GroupIcon />,
    },
    {
      label: "Đơn chờ thanh toán",
      value: data?.summary.pendingOrders.toLocaleString("vi-VN") ?? "—",
      hint: data
        ? revenueMoney(data.summary.pendingAmount) + " chưa tính vào doanh thu"
        : "—",
      icon: <TimeIcon />,
    },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            Doanh thu
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Theo dõi doanh thu mua đề thi và các giao dịch thanh toán đã lưu
            trong hệ thống.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load()}
        >
          Làm mới
        </Button>
      </div>

      <form
        onSubmit={apply}
        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Từ ngày
            <input
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? "revenue-date-error" : undefined}
              type="date"
              required
              className={control}
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Đến ngày
            <input
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? "revenue-date-error" : undefined}
              type="date"
              required
              className={control}
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Cấp HSK của đề
            <select
              className={control}
              value={filters.hskLevel}
              onChange={(e) =>
                setFilters({ ...filters, hskLevel: e.target.value })
              }
            >
              <option value="">Tất cả cấp độ</option>
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i} value={i + 1}>
                  HSK {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Trạng thái bảng giao dịch
            <select
              className={control}
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Tìm giao dịch
            <input
              className={control}
              maxLength={500}
              value={filters.search}
              placeholder="Mã đơn, tên, email, đề thi"
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </label>
        </div>
        {dateError && (
          <p
            id="revenue-date-error"
            role="alert"
            className="mt-3 text-sm text-error-600 dark:text-error-400"
          >
            {dateError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={loading}>
            Áp dụng
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={reset}
          >
            Đặt lại
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Giờ Việt Nam · Tối đa 366 ngày. Trạng thái chỉ lọc bảng giao dịch.
          </p>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
        >
          {error}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Thử lại
            </Button>
          </div>
        </div>
      )}

      <section
        aria-label="Báo cáo doanh thu"
        aria-busy={loading}
        className={loading && data ? "space-y-6 opacity-60" : "space-y-6"}
      >
        <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
          {loading
            ? "Đang tải báo cáo doanh thu…"
            : data
              ? `${revenueDay(data.period.from)} – ${revenueDay(data.period.to)} · Cập nhật ${revenueTime(data.generatedAt)}`
              : "Chưa tải được số liệu."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300 [&>svg]:h-6 [&>svg]:w-6">
                {metric.icon}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {metric.label}
              </p>
              <p className="mt-2 break-words text-2xl font-semibold text-gray-800 dark:text-white/90">
                {metric.value}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {metric.hint}
              </p>
            </div>
          ))}
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-3">
          <ComponentCard
            title="Doanh thu theo ngày"
            desc="Tổng tiền các đơn đã thanh toán được ghi nhận trong từng ngày."
            className="min-w-0 xl:col-span-2"
          >
            {data?.summary.paidOrders ? (
              <div className="min-w-0">
                <RevenueChart
                  options={chartOptions}
                  series={series}
                  type="area"
                  height={300}
                />
              </div>
            ) : (
              <p className="flex min-h-64 items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400">
                {loading
                  ? "Đang tải biểu đồ…"
                  : "Chưa có đơn thanh toán thành công trong khoảng thời gian này."}
              </p>
            )}
            {data && (
              <details className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                <summary className="cursor-pointer text-brand-600 dark:text-brand-300">
                  Xem số liệu từng ngày
                </summary>
                <div className="mt-3 max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell isHeader scope="col" className={headingCell}>
                          Ngày
                        </TableCell>
                        <TableCell isHeader scope="col" className={headingCell}>
                          Đơn đã thanh toán
                        </TableCell>
                        <TableCell isHeader scope="col" className={headingCell}>
                          Doanh thu
                        </TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.chart.map((day) => (
                        <TableRow
                          key={day.date}
                          className="border-t border-gray-100 dark:border-gray-800"
                        >
                          <TableCell className={cell}>
                            {revenueDay(day.date)}
                          </TableCell>
                          <TableCell className={cell}>
                            {day.paidOrders}
                          </TableCell>
                          <TableCell className={cell}>
                            {revenueMoney(day.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            )}
          </ComponentCard>
          <ComponentCard
            title="Đề thi có doanh thu cao"
            desc="Tối đa 5 đề theo doanh thu đã xác nhận."
            className="min-w-0"
          >
            {data?.topExams.length ? (
              <ol className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.topExams.map((exam, index) => (
                  <li
                    key={`${exam.examId}-${exam.examTitle}-${exam.hskLevel}`}
                    className="flex gap-3 py-4 first:pt-0"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-gray-800 dark:text-white/90">
                        {exam.examTitle}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        HSK {exam.hskLevel} · {exam.paidOrders} đơn
                      </p>
                      <p className="mt-2 text-sm font-semibold text-brand-600 dark:text-brand-300">
                        {revenueMoney(exam.revenue)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {loading ? "Đang tải…" : "Chưa có doanh thu."}
              </p>
            )}
          </ComponentCard>
        </div>

        <ComponentCard
          title="Giao dịch mua đề thi"
          desc={
            data
              ? `${data.total.toLocaleString("vi-VN")} giao dịch phù hợp · ${data.summary.cancelledOrders} đơn hủy · ${data.summary.expiredOrders} đơn hết hạn trong báo cáo`
              : "20 giao dịch mỗi trang"
          }
          className="min-w-0"
        >
          <div className="max-w-full overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    "Mã đơn",
                    "Khách hàng",
                    "Đề thi",
                    "Số tiền",
                    "Trạng thái",
                    "Ngày ghi nhận",
                  ].map((label) => (
                    <TableCell
                      key={label}
                      isHeader
                      scope="col"
                      className={headingCell}
                    >
                      {label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {loading
                        ? "Đang tải giao dịch…"
                        : "Chưa tải được giao dịch."}
                    </TableCell>
                  </TableRow>
                ) : !data.transactions.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      Không có giao dịch phù hợp với bộ lọc.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.transactions.map((order) => (
                    <TableRow
                      key={order.id}
                      className="border-t border-gray-100 dark:border-gray-800"
                    >
                      <TableCell
                        className={
                          cell +
                          " whitespace-nowrap font-medium text-gray-800 dark:text-white/90"
                        }
                      >
                        {order.orderCode}
                      </TableCell>
                      <TableCell className={cell}>
                        <p className="min-w-36 font-medium text-gray-800 dark:text-white/90">
                          {order.buyerName}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {order.buyerEmail || `Tài khoản #${order.userId}`}
                        </p>
                      </TableCell>
                      <TableCell className={cell}>
                        <p className="min-w-48 max-w-80">{order.examTitle}</p>
                        <span className="mt-1 inline-block whitespace-nowrap text-xs">
                          HSK {order.hskLevel}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cell + " whitespace-nowrap font-medium"}
                      >
                        {revenueMoney(order.amount)}
                      </TableCell>
                      <TableCell className={cell + " whitespace-nowrap"}>
                        <Badge color={statusColor[order.status]}>
                          {PAYMENT_STATUS_LABELS[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className={cell + " whitespace-nowrap"}>
                        {revenueTime(order.eventAt)}
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {order.status === "paid"
                            ? "Xác nhận thanh toán"
                            : "Tạo đơn"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-5 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {data.total
                  ? `${(data.page - 1) * data.limit + 1}–${Math.min(data.page * data.limit, data.total)} / ${data.total} giao dịch`
                  : "0 giao dịch"}
              </p>
              {data.totalPages > 1 && (
                <Pagination
                  currentPage={data.page}
                  totalPages={data.totalPages}
                  disabled={loading}
                  previousLabel="Trước"
                  nextLabel="Sau"
                  onPageChange={(page) => setQuery({ ...query, page })}
                />
              )}
            </div>
          )}
        </ComponentCard>
      </section>
      <p className="text-xs leading-6 text-gray-500 dark:text-gray-400">
        Doanh thu là tổng giá trị đơn đã được hệ thống xác nhận thanh toán qua
        payOS; chưa trừ phí hoặc hoàn tiền. Đơn đã thanh toán lọc theo ngày xác
        nhận, các trạng thái khác lọc theo ngày tạo đơn. Số liệu không phải số
        dư tài khoản ngân hàng; đơn chờ, hủy và hết hạn không được cộng vào
        doanh thu.
      </p>
    </div>
  );
}
