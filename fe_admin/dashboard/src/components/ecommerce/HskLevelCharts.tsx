"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { apiFetch } from "@/lib/api";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export const HskLevelCharts = () => {
  const [currentHsk, setCurrentHsk] = useState<number[]>(Array(9).fill(0));
  const [targetHsk, setTargetHsk] = useState<number[]>(Array(9).fill(0));

  useEffect(() => {
    const fetchHskDistribution = async () => {
      try {
        const res = await apiFetch('analytics/hsk-distribution');
        if (res.ok) {
          const data = await res.json();
          if (data.currentHsk && data.targetHsk) {
            setCurrentHsk(data.currentHsk);
            setTargetHsk(data.targetHsk);
          }
        }
      } catch (err) {
        console.error("Failed to fetch HSK distribution", err);
      }
    };
    fetchHskDistribution();
  }, []);

  const getOptions = (title: string): ApexOptions => ({
    chart: {
      type: "pie",
      fontFamily: "Outfit, sans-serif",
    },
    labels: ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6", "HSK 7", "HSK 8", "HSK 9"],
    colors: [
      "#465FFF", "#9CB9FF", "#FF7F5C", "#FFD700", "#FF69B4", "#8A2BE2", "#20B2AA", "#FFA07A", "#778899"
    ],
    legend: {
      position: "bottom",
      fontSize: "12px",
    },
    dataLabels: {
      enabled: true,
      formatter: function (val, opts) {
        return opts.w.config.series[opts.seriesIndex];
      }
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return val + " người";
        }
      }
    }
  });

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 flex flex-col items-center">
        <h3 className="w-full text-center text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
          Trình độ hiện tại
        </h3>
        <Chart options={getOptions("")} series={currentHsk} type="pie" height={320} width={"100%"} />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 flex flex-col items-center">
        <h3 className="w-full text-center text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
          Trình độ mong muốn
        </h3>
        <Chart options={getOptions("")} series={targetHsk} type="pie" height={320} width={"100%"} />
      </div>
    </>
  );
};
