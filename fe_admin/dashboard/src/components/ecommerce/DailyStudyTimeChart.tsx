"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import DistributionChart from "./DistributionChart";

type StudyTime = { time: number; count: number };

export const DailyStudyTimeChart = () => {
  const [data, setData] = useState<StudyTime[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("analytics/daily-study-time-distribution", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json() as StudyTime[];
        if (!Array.isArray(result)) throw new Error("Invalid study-time distribution");
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <DistributionChart id="daily-study-time-distribution" title="Mục tiêu học tập hàng ngày"
      labels={data?.map((item) => `Mục tiêu ${item.time} phút`) ?? []}
      series={data?.map((item) => item.count) ?? null} error={error} />
  );
};
