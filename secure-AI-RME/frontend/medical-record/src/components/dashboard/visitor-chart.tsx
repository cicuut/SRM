"use client";

import { useMemo } from "react";

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

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const PADDING = { top: 16, right: 16, bottom: 36, left: 44 };

function formatDayLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
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
    const datedSeries = series.map((item, index) => ({
      ...item,
      color: item.color || SERVICE_COLORS[item.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      points: [...item.history, ...item.forecast].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    }));

    const allDates = Array.from(
      new Set(
        datedSeries.flatMap((item) => item.points.map((point) => point.date)),
      ),
    ).sort();

    if (allDates.length === 0) {
      return null;
    }

    const maxCount = Math.max(
      ...datedSeries.flatMap((item) => item.points.map((point) => point.count)),
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
      y: PADDING.top + plotHeight - ratio * plotHeight,
      label: Math.round(maxCount * ratio),
    }));

    const xLabels = allDates.filter(
      (_, index) =>
        index === 0 ||
        index === allDates.length - 1 ||
        index % Math.ceil(allDates.length / 6) === 0,
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
          className="min-w-[640px] w-full"
          role="img"
          aria-label={title}
        >
          {chart.gridLines.map((line) => (
            <g key={line.label}>
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
              {formatDayLabel(date)}
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
