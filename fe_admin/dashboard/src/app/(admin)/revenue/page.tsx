import type { Metadata } from "next";
import RevenueDashboard from "@/components/ecommerce/RevenueDashboard";

export const metadata: Metadata = {
  title: "Doanh thu | TriceHSK Admin",
  description: "Thống kê doanh thu và giao dịch mua đề thi qua payOS.",
};

export default function RevenuePage() {
  return <RevenueDashboard />;
}
