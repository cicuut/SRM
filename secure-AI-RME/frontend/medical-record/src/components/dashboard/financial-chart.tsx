"use client";

import { useMemo } from "react";
import { fillAmountPoints, getDaysInMonth } from "@/utils/chart-month-days";

export interface FinancialChartPoint {
  date: string;
  amount: number;
}

interface FinancialChartProps {
  title: string;
  income: FinancialChartPoint[];
  expense: FinancialChartPoint[];
  emptyMessage?: string;
}

const INCOME_COLOR = "#16A34A";
const EXPENSE_COLOR = "#DC2626";

const CHART_WIDTH = 900;
const CHART_HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 36, left: 52 };

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

function formatAxisAmount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}jt`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}rb`;
  }
  return String(Math.round(value));
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function buildPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export function FinancialChart({
  title,
  income,
  expense,
  emptyMessage = "Belum ada data keuangan bulan ini",
}: FinancialChartProps) {
  const chart = useMemo(() => {
    const monthDates = getDaysInMonth();
    const filledIncome = fillAmountPoints(income, monthDates);
    const filledExpense = fillAmountPoints(expense, monthDates);

    const hasAnyData =
      filledIncome.some((point) => point.amount > 0) ||
      filledExpense.some((point) => point.amount > 0);

    if (!hasAnyData) {
      return null;
    }

    const allDates = monthDates;
    const incomeMap = new Map(filledIncome.map((p) => [p.date, p.amount]));
    const expenseMap = new Map(filledExpense.map((p) => [p.date, p.amount]));

    const maxAmount = Math.max(
      ...allDates.map((date) =>
        Math.max(incomeMap.get(date) ?? 0, expenseMap.get(date) ?? 0),
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

    const yForAmount = (amount: number) =>
      PADDING.top + plotHeight - (amount / maxAmount) * plotHeight;

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      ratio,
      y: PADDING.top + plotHeight - ratio * plotHeight,
      label: formatAxisAmount(maxAmount * ratio),
    }));

    const labelStep = Math.max(1, Math.ceil(allDates.length / 8));
    const xLabels = allDates.filter(
      (_, index) =>
        index === 0 ||
        index === allDates.length - 1 ||
        index % labelStep === 0,
    );

    const buildLine = (dataMap: Map<string, number>, color: string) => {
      const points = allDates.map((date) => ({
        x: xForDate(date),
        y: yForAmount(dataMap.get(date) ?? 0),
        date,
        amount: dataMap.get(date) ?? 0,
      }));

      return { path: buildPath(points), points, color };
    };

    return {
      allDates,
      gridLines,
      xLabels,
      xForDate,
      incomeLine: buildLine(incomeMap, INCOME_COLOR),
      expenseLine: buildLine(expenseMap, EXPENSE_COLOR),
    };
  }, [income, expense]);

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
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-5 rounded-full"
            style={{ backgroundColor: INCOME_COLOR }}
          />
          Income harian
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-5 rounded-full"
            style={{ backgroundColor: EXPENSE_COLOR }}
          />
          Expense harian
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

          {[chart.incomeLine, chart.expenseLine].map((line) => (
            <g key={line.color}>
              <path
                d={line.path}
                fill="none"
                stroke={line.color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {line.points.map((point) => (
                <circle
                  key={`${line.color}-${point.date}`}
                  cx={point.x}
                  cy={point.y}
                  r={3.5}
                  fill="#fff"
                  stroke={line.color}
                  strokeWidth={2}
                >
                  <title>
                    {formatDayLabel(point.date)}: {formatRupiah(point.amount)}
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
