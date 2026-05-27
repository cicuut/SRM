'use client';

import { useMemo, useState } from 'react';
import {
    fillCountPoints,
    getDaysInMonth,
    toDateKey,
} from '@/utils/chart-month-days';

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

type ChartMode = 'area' | 'line' | 'bar';

type DatedServiceSeries = {
    name: string;
    color: string;
    history: ChartPoint[];
    forecast: ChartPoint[];
};

type ChartLinePoint = {
    date: string;
    count: number;
    x: number;
    y: number;
};

type TooltipItem = {
    label: string;
    value: number;
    color: string;
    type: 'Aktual' | 'Forecast';
};

type TooltipState = {
    x: number;
    y: number;
    date: string;
    items: TooltipItem[];
};

export const SERVICE_COLORS: Record<string, string> = {
    Kehamilan: '#4F6F52',
    'Keluarga Berencana': '#B8A47E',
    Umum: '#739072',
    Imunisasi: '#86A789',
    Persalinan: '#5F785F',
};

const FALLBACK_COLORS = [
    '#4F6F52',
    '#739072',
    '#86A789',
    '#5F785F',
    '#B8A47E',
    '#7C8F65',
];

const CHART_WIDTH = 920;
const CHART_HEIGHT = 280;

const PADDING = {
    top: 22,
    right: 26,
    bottom: 48,
    left: 58,
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

function formatNumber(value: number) {
    return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

function buildPath(points: { x: number; y: number }[]): string {
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
                        key={`${item.label}-${item.type}`}
                        className="flex items-center justify-between gap-4"
                    >
                        <div className="flex min-w-0 items-center gap-2">
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{
                                    backgroundColor: item.color,
                                }}
                            />

                            <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold text-[#4B4B4B]">
                                    {item.label}
                                </p>

                                <p className="text-[10px] font-bold text-[#8A8A8A]">
                                    {item.type}
                                </p>
                            </div>
                        </div>

                        <p className="text-[12px] font-extrabold text-black">
                            {formatNumber(item.value)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export function VisitorChart({
    title,
    series,
    emptyMessage = 'Belum ada data kunjungan',
}: VisitorChartProps) {
    const [chartMode, setChartMode] = useState<ChartMode>('area');
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    const chart = useMemo(() => {
        const monthDates = getDaysInMonth();
        const todayKey = toDateKey();

        const historyDates = monthDates.filter((date) => date <= todayKey);
        const forecastDates = monthDates.filter((date) => date > todayKey);

        const datedSeries: DatedServiceSeries[] = series.map((item, index) => ({
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

        if (!hasAnyData) {
            return null;
        }

        const maxCount = Math.max(
            ...datedSeries.flatMap((item) =>
                [...item.history, ...item.forecast].map((point) => point.count),
            ),
            1,
        );

        const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
        const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

        const xForDate = (date: string) => {
            const index = monthDates.indexOf(date);

            if (monthDates.length === 1) {
                return PADDING.left + plotWidth / 2;
            }

            return PADDING.left + (index / (monthDates.length - 1)) * plotWidth;
        };

        const yForCount = (count: number) =>
            PADDING.top + plotHeight - (count / maxCount) * plotHeight;

        const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
            ratio,
            y: PADDING.top + plotHeight - ratio * plotHeight,
            label: formatNumber(Math.round(maxCount * ratio)),
        }));

        const baselineY = yForCount(0);

        const lineSeries = datedSeries.map((item) => {
            const historyPoints: ChartLinePoint[] = item.history.map((point) => ({
                date: point.date,
                count: point.count,
                x: xForDate(point.date),
                y: yForCount(point.count),
            }));

            const forecastPoints: ChartLinePoint[] = item.forecast.map((point) => ({
                date: point.date,
                count: point.count,
                x: xForDate(point.date),
                y: yForCount(point.count),
            }));

            const forecastLinePoints =
                historyPoints.length > 0 && forecastPoints.length > 0
                    ? [historyPoints[historyPoints.length - 1], ...forecastPoints]
                    : forecastPoints;

            return {
                ...item,
                historyPoints,
                forecastPoints,
                forecastLinePoints,
                historyPath: buildPath(historyPoints),
                forecastPath: buildPath(forecastLinePoints),
                historyAreaPath: buildAreaPath(historyPoints, baselineY),
                forecastAreaPath: buildAreaPath(forecastLinePoints, baselineY),
            };
        });

        return {
            monthDates,
            todayKey,
            datedSeries,
            lineSeries,
            maxCount,
            plotWidth,
            plotHeight,
            xForDate,
            yForCount,
            gridLines,
            baselineY,
        };
    }, [series]);

    const showTooltip = ({
        date,
        x,
        y,
        items,
    }: {
        date: string;
        x: number;
        y: number;
        items: TooltipItem[];
    }) => {
        setTooltip({
            date,
            x,
            y,
            items,
        });
    };

    if (!chart) {
        return (
            <div className="rounded-[18px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-10 text-center text-sm text-gray-500">
                {emptyMessage}
            </div>
        );
    }

    const xTickStep = Math.max(1, Math.ceil(chart.monthDates.length / 8));
    const slotWidth = chart.plotWidth / Math.max(chart.monthDates.length, 1);
    const groupWidth = Math.min(22, slotWidth * 0.78);
    const barWidth = Math.max(
        2,
        Math.min(8, groupWidth / Math.max(chart.datedSeries.length, 1)),
    );

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

                    {chart.monthDates.map((date, index) => {
                        if (
                            index !== 0 &&
                            index !== chart.monthDates.length - 1 &&
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
                        chart.datedSeries.map((service, serviceIndex) => {
                            const xOffset =
                                -groupWidth / 2 +
                                serviceIndex * barWidth +
                                barWidth / 2;

                            return (
                                <g key={`bar-${service.name}`}>
                                    {[...service.history, ...service.forecast].map(
                                        (point) => {
                                            const x =
                                                chart.xForDate(point.date) + xOffset;
                                            const y = chart.yForCount(point.count);
                                            const isForecast =
                                                point.date > chart.todayKey;

                                            return (
                                                <rect
                                                    key={`${service.name}-${point.date}`}
                                                    x={x}
                                                    y={y}
                                                    width={barWidth}
                                                    height={chart.baselineY - y}
                                                    rx={barWidth / 2}
                                                    fill={service.color}
                                                    opacity={isForecast ? 0.42 : 0.92}
                                                    className="cursor-pointer transition-opacity hover:opacity-80"
                                                    onMouseEnter={() =>
                                                        showTooltip({
                                                            date: point.date,
                                                            x,
                                                            y,
                                                            items: [
                                                                {
                                                                    label: service.name,
                                                                    value: point.count,
                                                                    color: service.color,
                                                                    type: isForecast
                                                                        ? 'Forecast'
                                                                        : 'Aktual',
                                                                },
                                                            ],
                                                        })
                                                    }
                                                />
                                            );
                                        },
                                    )}
                                </g>
                            );
                        })}

                    {chartMode === 'area' &&
                        chart.lineSeries.map((line) => (
                            <g key={`area-${line.name}`}>
                                <path
                                    d={line.historyAreaPath}
                                    fill={line.color}
                                    opacity={0.14}
                                />

                                <path
                                    d={line.forecastAreaPath}
                                    fill={line.color}
                                    opacity={0.08}
                                />
                            </g>
                        ))}

                    {(chartMode === 'area' || chartMode === 'line') &&
                        chart.lineSeries.map((line) => (
                            <g key={line.name}>
                                <path
                                    d={line.historyPath}
                                    fill="none"
                                    stroke={line.color}
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                <path
                                    d={line.forecastPath}
                                    fill="none"
                                    stroke={line.color}
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray="7 7"
                                    opacity={0.88}
                                />

                                {line.historyPoints.map((point) => (
                                    <circle
                                        key={`${line.name}-h-${point.date}`}
                                        cx={point.x}
                                        cy={point.y}
                                        r={4}
                                        fill="#FFFFFF"
                                        stroke={line.color}
                                        strokeWidth={2.4}
                                        className="cursor-pointer transition-all"
                                        onMouseEnter={() =>
                                            showTooltip({
                                                date: point.date,
                                                x: point.x,
                                                y: point.y,
                                                items: [
                                                    {
                                                        label: line.name,
                                                        value: point.count,
                                                        color: line.color,
                                                        type: 'Aktual',
                                                    },
                                                ],
                                            })
                                        }
                                    />
                                ))}

                                {line.forecastPoints.map((point) => (
                                    <circle
                                        key={`${line.name}-f-${point.date}`}
                                        cx={point.x}
                                        cy={point.y}
                                        r={3.8}
                                        fill={line.color}
                                        stroke="#FFFFFF"
                                        strokeWidth={1.8}
                                        opacity={0.9}
                                        className="cursor-pointer transition-all"
                                        onMouseEnter={() =>
                                            showTooltip({
                                                date: point.date,
                                                x: point.x,
                                                y: point.y,
                                                items: [
                                                    {
                                                        label: line.name,
                                                        value: point.count,
                                                        color: line.color,
                                                        type: 'Forecast',
                                                    },
                                                ],
                                            })
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

                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    {chart.datedSeries.map((service) => (
                        <div key={service.name} className="flex items-center gap-2">
                            <span
                                className="h-3 w-3 rounded-full"
                                style={{
                                    backgroundColor: service.color,
                                }}
                            />

                            <p className="text-[11px] font-bold text-[#4B4B4B]">
                                {service.name}
                            </p>
                        </div>
                    ))}

                    <div className="flex items-center gap-2">
                        <span className="h-[2px] w-6 rounded-full bg-[#4B4B4B]" />
                        <p className="text-[11px] font-bold text-[#4B4B4B]">
                            Aktual
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="h-[2px] w-6 rounded-full border-t-2 border-dashed border-[#4B4B4B]" />
                        <p className="text-[11px] font-bold text-[#4B4B4B]">
                            Forecast
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}