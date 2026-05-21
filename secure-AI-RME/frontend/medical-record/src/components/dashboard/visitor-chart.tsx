"use client";

import { useMemo } from "react";
import {
  fillCountPoints,
  getDaysInMonth,
  toDateKey,
} from "@/utils/chart-month-days";

export interface ChartPoint {
  date: string;
  count: number;
}

export interface ServiceSeries {
  name: string;
  history: ChartPoint[];
  forecast: ChartPoint[];
  color: string;
}

interface VisitorChartProps {
  title: string;
  series: ServiceSeries[];
  emptyMessage?: string;
}

export const SERVICE_COLORS: Record<string, string> = {
  Kehamilan: "#2563EB",
  "Keluarga Berencana": "#DC2626",
  Umum: "#7C3AED",
  Imunisasi: "#EA580C",
  Persalinan: "#0891B2",
};

const FALLBACK_COLORS = [
  "#2563EB",
  "#DC2626",
  "#7C3AED",
  "#EA580C",
  "#0891B2",
  "#059669",
];

const CHART_WIDTH = 900;
const CHART_HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 36, left: 44 };

function formatDayLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAxisDayLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return String(parsed.getDate());
}

function buildPath(
  points: { x: number; y: number }[],
): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export function VisitorChart({
  title,
  series,
  emptyMessage = "Belum ada data kunjungan",
}: VisitorChartProps) {
  const chart = useMemo(() => {
    const monthDates = getDaysInMonth();
    const todayKey = toDateKey();
    const historyDates = monthDates.filter((date) => date <= todayKey);
    const forecastDates = monthDates.filter((date) => date > todayKey);

    const datedSeries = series.map((item, index) => ({
      ...item,
      color:
        item.color ||
        SERVICE_COLORS[item.name] ||
        FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      history: fillCountPoints(item.history, historyDates),
      forecast: fillCountPoints(item.forecast, forecastDates),
    }));

    const hasAnyData = datedSeries.some(
      (item) =>
        item.history.some((point) => point.count > 0) ||
        item.forecast.some((point) => point.count > 0),
    );

    if (!hasAnyData && monthDates.length === 0) {
      return null;
    }

    const allDates = monthDates;

    const maxCount = Math.max(
      ...datedSeries.flatMap((item) =>
        [...item.history, ...item.forecast].map((point) => point.count),
      ),
      1,
    );

    const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

    const xForDate = (date: string) => {
      const index = allDates.indexOf(date);
      if (allDates.length === 1) return PADDING.left + plotWidth / 2;
      return PADDING.left + (index / (allDates.length - 1)) * plotWidth;
    };

    const yForCount = (count: number) =>
      PADDING.top + plotHeight - (count / maxCount) * plotHeight;

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      ratio,
      y: PADDING.top + plotHeight - ratio * plotHeight,
      label: Math.round(maxCount * ratio),
    }));

    const labelStep = Math.max(1, Math.ceil(allDates.length / 8));
    const xLabels = allDates.filter(
      (_, index) =>
        index === 0 ||
        index === allDates.length - 1 ||
        index % labelStep === 0,
    );

    const lines = datedSeries.map((item) => {
      const historyPoints = item.history.map((point) => ({
        x: xForDate(point.date),
        y: yForCount(point.count),
        date: point.date,
        count: point.count,
      }));

      const forecastPoints = item.forecast.map((point) => ({
        x: xForDate(point.date),
        y: yForCount(point.count),
        date: point.date,
        count: point.count,
      }));

      const forecastLinePoints =
        historyPoints.length > 0 && forecastPoints.length > 0
          ? [historyPoints[historyPoints.length - 1], ...forecastPoints]
          : forecastPoints;

      return {
        name: item.name,
        color: item.color,
        historyPath: buildPath(historyPoints),
        forecastPath: buildPath(forecastLinePoints),
        historyPoints,
        forecastPoints,
      };
    });

    return { allDates, gridLines, xLabels, lines, maxCount, xForDate };
  }, [series]);

  if (!chart) {
    return (
      <div className="flex h-full flex-col">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-6 text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h2 className="text-xl font-semibold">{title}</h2>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
        {chart.lines.map((line) => (
          <span key={line.name} className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-5 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            {line.name}
          </span>
        ))}
        <span className="flex items-center gap-2 text-gray-500">
          <span className="inline-block w-5 border-t-2 border-dashed border-gray-400" />
          Perkiraan
        </span>
      </div>

      <div className="mt-2 w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="min-w-[800px] w-full"
          role="img"
          aria-label={title}
        >
          {chart.gridLines.map((line) => (
            <g key={`grid-${line.ratio}`}>
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={line.y}
                y2={line.y}
                stroke="#E8EDE7"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={line.y + 4}
                textAnchor="end"
                className="fill-gray-400 text-[10px]"
              >
                {line.label}
              </text>
            </g>
          ))}

          {chart.xLabels.map((date) => (
            <text
              key={date}
              x={chart.xForDate(date)}
              y={CHART_HEIGHT - 10}
              textAnchor="middle"
              className="fill-gray-500 text-[10px]"
            >
              {formatAxisDayLabel(date)}
            </text>
          ))}

          {chart.lines.map((line) => (
            <g key={line.name}>
              {line.historyPath && (
                <path
                  d={line.historyPath}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {line.forecastPath && (
                <path
                  d={line.forecastPath}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={3}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              )}
              {line.historyPoints.map((point) => (
                <circle
                  key={`${line.name}-h-${point.date}`}
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill="#fff"
                  stroke={line.color}
                  strokeWidth={2.5}
                >
                  <title>
                    {line.name} — {formatDayLabel(point.date)}: {point.count}{" "}
                    kunjungan (aktual)
                  </title>
                </circle>
              ))}
              {line.forecastPoints.map((point) => (
                <circle
                  key={`${line.name}-f-${point.date}`}
                  cx={point.x}
                  cy={point.y}
                  r={3.5}
                  fill={line.color}
                  opacity={0.85}
                >
                  <title>
                    {line.name} — Perkiraan {formatDayLabel(point.date)}:{" "}
                    {point.count} kunjungan
                  </title>
                </circle>
              ))}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
