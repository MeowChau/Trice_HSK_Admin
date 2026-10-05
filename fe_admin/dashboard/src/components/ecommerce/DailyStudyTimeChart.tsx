"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { apiFetch } from "@/lib/api";


const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export const DailyStudyTimeChart = () => {
  const [data, setData] = useState<{time: number, count: number}[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('analytics/daily-study-time-distribution');
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (err) {
        console.error("Failed to fetch study time distribution", err);
      }
    };
    fetchData();
  }, []);

  const labels = data.map(d => "Mục tiêu $d.time phút");
  const series = data.map(d => d.count);
  const colors = ["#465FFF", "#9CB9FF", "#FF7F5C", "#FFD700", "#FF69B4", "#8A2BE2", "#20B2AA", "#FFA07A", "#778899"];

  const options: ApexOptions = {
    chart: {
      type: "pie",
      fontFamily: "Outfit, sans-serif",
    },
    labels: labels.length > 0 ? labels : ["Chua c  d? li?u"],
    colors: colors,
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
          return val + " ngu?i";
        }
      }
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 flex flex-col items-center">
      <h3 className="w-full text-center text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Mục tiêu học tập hàng ngày
      </h3>
      <Chart options={options} series={series.length > 0 ? series : [1]} type="pie" height={320} width={"100%"} />
    </div>
  );
};

