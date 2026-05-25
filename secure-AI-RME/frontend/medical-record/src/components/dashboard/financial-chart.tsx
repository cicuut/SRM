'use client';

import { useMemo, useState } from 'react';
import { fillAmountPoints, getDaysInMonth } from '@/utils/chart-month-days';

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

type ChartMode = 'area' | 'line' | 'bar';

type ChartLinePoint = {
    date: string;
    amount: number;
    x: number;
    y: number;
};

type TooltipItem = {
    label: string;
    value: number;
    color: string;
};

type TooltipState = {
    x: number;
    y: number;
    date: string;
    items: TooltipItem[];
};

const INCOME_COLOR = '#4F6F52';
const EXPENSE_COLOR = '#B8A47E';

const CHART_WIDTH = 920;
const CHART_HEIGHT = 280;

const PADDING = {
    top: 22,
    right: 26,
    bottom: 48,
    left: 68,
};

function formatDayLabel(value: string) {
    const parsed = new Date(`${value}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function formatAxisDayLabel(value: string) {
    const parsed = new Date(`${value}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

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
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number(value || 0));
}

function buildPath(points: { x: number; y: number }[]) {
    if (points.length === 0) return '';

    return points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');
}

function buildAreaPath(points: { x: number; y: number }[], baselineY: number) {
    if (points.length === 0) return '';

    const linePath = buildPath(points);
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    return `${linePath} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;
}

function getTooltipStyle(tooltip: TooltipState) {
    const leftPercent = (tooltip.x / CHART_WIDTH) * 100;
    const topPercent = (tooltip.y / CHART_HEIGHT) * 100;
    const isNearTop = tooltip.y < 105;

    return {
        left: `clamp(125px, ${leftPercent}%, calc(100% - 125px))`,
        top: isNearTop
            ? `clamp(18px, ${topPercent}%, calc(100% - 150px))`
            : `clamp(145px, ${topPercent}%, calc(100% - 12px))`,
        transform: isNearTop
            ? 'translate(-50%, 16px)'
            : 'translate(-50%, calc(-100% - 14px))',
    };
}

const ChartModeButton = ({
    label,
    mode,
    activeMode,
    onClick,
}: {
    label: string;
    mode: ChartMode;
    activeMode: ChartMode;
    onClick: (mode: ChartMode) => void;
}) => {
    const isActive = activeMode === mode;

    return (
        <button
            type="button"
            onClick={() => onClick(mode)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
                isActive
                    ? 'bg-[#739072] text-white shadow-sm'
                    : 'bg-white text-[#5F785F] hover:bg-[#EEF3E9]'
            }`}
        >
            {label}
        </button>
    );
};

const ChartTooltip = ({ tooltip }: { tooltip: TooltipState }) => {
    const incomeValue =
        tooltip.items.find((item) => item.label === 'Pemasukan')?.value || 0;
    const expenseValue =
        tooltip.items.find((item) => item.label === 'Pengeluaran')?.value || 0;
    const balance = incomeValue - expenseValue;

    return (
        <div
            className="pointer-events-none absolute z-20 w-[230px] max-w-[calc(100%-24px)] rounded-[16px] border border-[#D2D8CF] bg-white px-4 py-3 shadow-[0_16px_34px_rgba(0,0,0,0.14)]"
            style={getTooltipStyle(tooltip)}
        >
            <p className="text-[12px] font-extrabold text-[#4F6F52]">
                {formatDayLabel(tooltip.date)}
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2">
                {tooltip.items.map((item) => (
                    <div
                        key={item.label}
                        className="flex items-center justify-between gap-4"
                    >
                        <div className="flex min-w-0 items-center gap-2">
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{
                                    backgroundColor: item.color,
                                }}
                            />

                            <p className="truncate text-[11px] font-semibold text-[#4B4B4B]">
                                {item.label}
                            </p>
                        </div>

                        <p className="text-[12px] font-extrabold text-black">
                            {formatRupiah(item.value)}
                        </p>
                    </div>
                ))}

                <div className="mt-2 border-t border-[#E4E8E1] pt-2">
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-[11px] font-bold text-[#5F785F]">
                            Saldo
                        </p>

                        <p
                            className={`text-[12px] font-extrabold ${
                                balance < 0 ? 'text-red-600' : 'text-[#4F6F52]'
                            }`}
                        >
                            {formatRupiah(balance)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export function FinancialChart({
    title,
    income,
    expense,
    emptyMessage = 'Belum ada data keuangan bulan ini',
}: FinancialChartProps) {
    const [chartMode, setChartMode] = useState<ChartMode>('area');
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

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

        const incomeMap = new Map(
            filledIncome.map((point) => [point.date, point.amount]),
        );

        const expenseMap = new Map(
            filledExpense.map((point) => [point.date, point.amount]),
        );

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

            if (allDates.length === 1) {
                return PADDING.left + plotWidth / 2;
            }

            return PADDING.left + (index / (allDates.length - 1)) * plotWidth;
        };

        const yForAmount = (amount: number) =>
            PADDING.top + plotHeight - (amount / maxAmount) * plotHeight;

        const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
            ratio,
            y: PADDING.top + plotHeight - ratio * plotHeight,
            label: formatAxisAmount(maxAmount * ratio),
        }));

        const incomePoints: ChartLinePoint[] = allDates.map((date) => {
            const amount = incomeMap.get(date) ?? 0;

            return {
                date,
                amount,
                x: xForDate(date),
                y: yForAmount(amount),
            };
        });

        const expensePoints: ChartLinePoint[] = allDates.map((date) => {
            const amount = expenseMap.get(date) ?? 0;

            return {
                date,
                amount,
                x: xForDate(date),
                y: yForAmount(amount),
            };
        });

        const baselineY = yForAmount(0);

        return {
            allDates,
            incomeMap,
            expenseMap,
            maxAmount,
            plotWidth,
            plotHeight,
            xForDate,
            yForAmount,
            gridLines,
            baselineY,
            incomeLine: {
                label: 'Pemasukan',
                color: INCOME_COLOR,
                points: incomePoints,
                path: buildPath(incomePoints),
                areaPath: buildAreaPath(incomePoints, baselineY),
            },
            expenseLine: {
                label: 'Pengeluaran',
                color: EXPENSE_COLOR,
                points: expensePoints,
                path: buildPath(expensePoints),
                areaPath: buildAreaPath(expensePoints, baselineY),
            },
        };
    }, [income, expense]);

    const showTooltipForDate = (date: string, x: number, y: number) => {
        if (!chart) return;

        setTooltip({
            x,
            y,
            date,
            items: [
                {
                    label: 'Pemasukan',
                    value: chart.incomeMap.get(date) ?? 0,
                    color: INCOME_COLOR,
                },
                {
                    label: 'Pengeluaran',
                    value: chart.expenseMap.get(date) ?? 0,
                    color: EXPENSE_COLOR,
                },
            ],
        });
    };

    if (!chart) {
        return (
            <div className="rounded-[18px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-10 text-center text-sm text-gray-500">
                {emptyMessage}
            </div>
        );
    }

    const xTickStep = Math.max(1, Math.ceil(chart.allDates.length / 8));
    const slotWidth = chart.plotWidth / Math.max(chart.allDates.length, 1);
    const barWidth = Math.min(11, Math.max(4, slotWidth * 0.28));

    return (
        <div className="w-full">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {title && (
                    <h2 className="text-xl font-semibold text-[#4F6F52]">
                        {title}
                    </h2>
                )}

                <div className="flex w-fit items-center gap-1 rounded-full border border-[#D2D8CF] bg-[#F8FAF6] p-1">
                    <ChartModeButton
                        label="Area"
                        mode="area"
                        activeMode={chartMode}
                        onClick={setChartMode}
                    />

                    <ChartModeButton
                        label="Line"
                        mode="line"
                        activeMode={chartMode}
                        onClick={setChartMode}
                    />

                    <ChartModeButton
                        label="Bar"
                        mode="bar"
                        activeMode={chartMode}
                        onClick={setChartMode}
                    />
                </div>
            </div>

            <div
                className="relative w-full overflow-hidden rounded-[20px] border border-[#E4E8E1] bg-[#F8FAF6] px-2 py-3"
                onMouseLeave={() => setTooltip(null)}
            >
                {tooltip && <ChartTooltip tooltip={tooltip} />}

                <svg
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    className="h-[320px] w-full"
                    role="img"
                    aria-label={title}
                >
                    <defs>
                        <linearGradient
                            id="incomeAreaGradient"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={INCOME_COLOR}
                                stopOpacity="0.22"
                            />
                            <stop
                                offset="100%"
                                stopColor={INCOME_COLOR}
                                stopOpacity="0.02"
                            />
                        </linearGradient>

                        <linearGradient
                            id="expenseAreaGradient"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={EXPENSE_COLOR}
                                stopOpacity="0.22"
                            />
                            <stop
                                offset="100%"
                                stopColor={EXPENSE_COLOR}
                                stopOpacity="0.02"
                            />
                        </linearGradient>
                    </defs>

                    <rect
                        x={PADDING.left}
                        y={PADDING.top}
                        width={chart.plotWidth}
                        height={chart.plotHeight}
                        rx={14}
                        fill="#FFFFFF"
                        opacity={0.68}
                    />

                    {chart.gridLines.map((line) => (
                        <g key={line.ratio}>
                            <line
                                x1={PADDING.left}
                                x2={CHART_WIDTH - PADDING.right}
                                y1={line.y}
                                y2={line.y}
                                stroke="#DDE8D6"
                                strokeDasharray="5 5"
                            />

                            <text
                                x={PADDING.left - 12}
                                y={line.y + 4}
                                textAnchor="end"
                                className="fill-[#5F5F5F] text-[11px] font-semibold"
                            >
                                {line.label}
                            </text>
                        </g>
                    ))}

                    {chart.allDates.map((date, index) => {
                        if (
                            index !== 0 &&
                            index !== chart.allDates.length - 1 &&
                            index % xTickStep !== 0
                        ) {
                            return null;
                        }

                        const x = chart.xForDate(date);

                        return (
                            <text
                                key={date}
                                x={x}
                                y={CHART_HEIGHT - 18}
                                textAnchor="middle"
                                className="fill-[#5F5F5F] text-[11px] font-semibold"
                            >
                                {formatAxisDayLabel(date)}
                            </text>
                        );
                    })}

                    {chartMode === 'bar' &&
                        chart.allDates.map((date) => {
                            const x = chart.xForDate(date);
                            const incomeValue = chart.incomeMap.get(date) ?? 0;
                            const expenseValue = chart.expenseMap.get(date) ?? 0;

                            const incomeY = chart.yForAmount(incomeValue);
                            const expenseY = chart.yForAmount(expenseValue);
                            const tooltipY = Math.min(incomeY, expenseY);

                            return (
                                <g key={`bar-${date}`}>
                                    <rect
                                        x={x - barWidth - 1}
                                        y={incomeY}
                                        width={barWidth}
                                        height={chart.baselineY - incomeY}
                                        rx={barWidth / 2}
                                        fill={INCOME_COLOR}
                                        className="cursor-pointer transition-opacity hover:opacity-80"
                                        onMouseEnter={() =>
                                            showTooltipForDate(date, x, tooltipY)
                                        }
                                    />

                                    <rect
                                        x={x + 1}
                                        y={expenseY}
                                        width={barWidth}
                                        height={chart.baselineY - expenseY}
                                        rx={barWidth / 2}
                                        fill={EXPENSE_COLOR}
                                        className="cursor-pointer transition-opacity hover:opacity-80"
                                        onMouseEnter={() =>
                                            showTooltipForDate(date, x, tooltipY)
                                        }
                                    />
                                </g>
                            );
                        })}

                    {chartMode === 'area' && (
                        <>
                            <path
                                d={chart.incomeLine.areaPath}
                                fill="url(#incomeAreaGradient)"
                            />

                            <path
                                d={chart.expenseLine.areaPath}
                                fill="url(#expenseAreaGradient)"
                            />
                        </>
                    )}

                    {(chartMode === 'area' || chartMode === 'line') &&
                        [chart.incomeLine, chart.expenseLine].map((line) => (
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
                                        r={4}
                                        fill="#FFFFFF"
                                        stroke={line.color}
                                        strokeWidth={2.4}
                                        className="cursor-pointer transition-all"
                                        onMouseEnter={() =>
                                            showTooltipForDate(
                                                point.date,
                                                point.x,
                                                point.y,
                                            )
                                        }
                                    />
                                ))}
                            </g>
                        ))}

                    {tooltip && (
                        <line
                            x1={tooltip.x}
                            x2={tooltip.x}
                            y1={PADDING.top}
                            y2={CHART_HEIGHT - PADDING.bottom}
                            stroke="#739072"
                            strokeWidth={1.5}
                            strokeDasharray="5 5"
                            opacity={0.7}
                        />
                    )}
                </svg>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                        <span
                            className="h-3 w-3 rounded-full"
                            style={{
                                backgroundColor: INCOME_COLOR,
                            }}
                        />

                        <p className="text-[11px] font-bold text-[#4B4B4B]">
                            Pemasukan
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span
                            className="h-3 w-3 rounded-full"
                            style={{
                                backgroundColor: EXPENSE_COLOR,
                            }}
                        />

                        <p className="text-[11px] font-bold text-[#4B4B4B]">
                            Pengeluaran
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}