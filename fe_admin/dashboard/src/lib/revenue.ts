export type PaymentStatus =
  | "creating"
  | "pending"
  | "paid"
  | "cancelled"
  | "expired";
export interface RevenueFilters {
  from: string;
  to: string;
  hskLevel: string;
  search: string;
  status: string;
}
export interface RevenueQuery extends RevenueFilters {
  page: number;
  limit: number;
}
export interface RevenueData {
  period: { from: string; to: string; timeZone: string };
  currency: "VND";
  summary: {
    totalRevenue: number;
    totalOrders: number;
    paidOrders: number;
    payingCustomers: number;
    pendingOrders: number;
    pendingAmount: number;
    cancelledOrders: number;
    expiredOrders: number;
    averageOrderValue: number;
  };
  chart: { date: string; revenue: number; paidOrders: number }[];
  topExams: {
    examId: number | null;
    examTitle: string;
    hskLevel: number;
    revenue: number;
    paidOrders: number;
  }[];
  transactions: {
    id: string;
    orderCode: string;
    userId: number;
    buyerName: string;
    buyerEmail: string | null;
    examId: number | null;
    examTitle: string;
    hskLevel: number;
    amount: number;
    status: PaymentStatus;
    createdAt: string;
    paidAt: string | null;
    expiresAt: string;
    eventAt: string;
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  generatedAt: string;
}
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  creating: "Đang tạo",
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  cancelled: "Đã hủy",
  expired: "Hết hạn",
};
export function defaultRevenueFilters(now = new Date()): RevenueFilters {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return {
    from: today.slice(0, 7) + "-01",
    to: today,
    hskLevel: "",
    search: "",
    status: "",
  };
}
export function revenueDateError(from: string, to: string): string | null {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to))
    return "Vui lòng chọn đủ ngày bắt đầu và kết thúc hợp lệ.";
  if (from > to) return "Ngày bắt đầu không được sau ngày kết thúc.";
  if ((Date.parse(to) - Date.parse(from)) / 86400000 + 1 > 366)
    return "Mỗi lần xem tối đa 366 ngày. Vui lòng thu hẹp khoảng thời gian.";
  return null;
}
export function revenuePath(query: RevenueQuery) {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.hskLevel) params.set("hskLevel", query.hskLevel);
  if (query.search.trim()) params.set("search", query.search.trim());
  if (query.status) params.set("status", query.status);
  return "exam-payments/admin/revenue?" + params;
}
const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
export function revenueMoney(value: number) {
  return money.format(value);
}
export function revenueDay(value: string) {
  return value.split("-").reverse().join("/");
}
export function revenueTime(value: string) {
  return Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";
}
