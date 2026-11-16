"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import DistributionChart from "./DistributionChart";

type Distribution = { currentHsk: number[]; targetHsk: number[] };
const labels = Array.from({ length: 9 }, (_, index) => `HSK ${index + 1}`);

export const HskLevelCharts = () => {
  const [data, setData] = useState<Distribution | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("analytics/hsk-distribution", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json() as Distribution;
        if (!Array.isArray(result.currentHsk) || !Array.isArray(result.targetHsk)) {
          throw new Error("Invalid HSK distribution");
        }
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <DistributionChart id="current-hsk-distribution" title="Trình độ hiện tại"
        labels={labels} series={data?.currentHsk ?? null} error={error} />
      <DistributionChart id="target-hsk-distribution" title="Trình độ mong muốn"
        labels={labels} series={data?.targetHsk ?? null} error={error} />
    </>
  );
};
