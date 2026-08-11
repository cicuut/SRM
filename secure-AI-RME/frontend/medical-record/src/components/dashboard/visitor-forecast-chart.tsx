'use client';

/**
 * VisitorForecastChart — grafik agregasi bulanan aktual vs forecast.
 * SVG custom (tanpa library chart), mengikuti gaya dashboard klinik.
 */

import { useMemo, useState } from 'react';
import {
    formatForecastMonthLabel,
    formatForecastMonthShort,
    formatForecastNumber,
    MonthlyChartPoint,
} from '@/utils/forecast-aggregation';

interface VisitorForecastChartProps {
    points: MonthlyChartPoint[];
    emptyMessage?: string;
}

type ChartPoint = {
    month: string;
    actual: number;
    forecast: number;
    total: number;
    x: number;
    actualY: number;
    forecastY: number;
    totalY: number;
};

type TooltipState = {
    x: number;
    y: number;
    point: MonthlyChartPoint;
};

const CHART_WIDTH = 920;
const CHART_HEIGHT = 300;

const PADDING = {
    top: 24,
    right: 28,
    bottom: 52,
    left: 58,
};

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
    const isNearTop = tooltip.y < 110;

    return {
        left: `clamp(130px, ${leftPercent}%, calc(100% - 130px))`,
        top: isNearTop
            ? `clamp(18px, ${topPercent}%, calc(100% - 150px))`
            : `clamp(145px, ${topPercent}%, calc(100% - 12px))`,
        transform: isNearTop
            ? 'translate(-50%, 16px)'
            : 'translate(-50%, calc(-100% - 14px))',
    };
}

export function VisitorForecastChart({
    points,
    emptyMessage = 'Belum ada data forecast bulanan',
}: VisitorForecastChartProps) {
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    const chart = useMemo(() => {
        if (!points.length) return null;

        const maxValue = Math.max(
            ...points.flatMap((point) => [
                point.actual,
                point.forecast,
                point.total,
            ]),
            1,
        );

        const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
        const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

        const xForIndex = (index: number) => {
            if (points.length === 1) {
                return PADDING.left + plotWidth / 2;
            }

            return PADDING.left + (index / (points.length - 1)) * plotWidth;
        };

        const yForValue = (value: number) =>
            PADDING.top + plotHeight - (value / maxValue) * plotHeight;

        const baselineY = yForValue(0);

        const plotted: ChartPoint[] = points.map((point, index) => ({
            ...point,
            x: xForIndex(index),
            actualY: yForValue(point.actual),
            forecastY: yForValue(point.forecast),
            totalY: yForValue(point.total),
        }));

        // Forecast line uses monthly totals so current month connects actual→expected
        const forecastLinePoints = plotted.map((point) => ({
            x: point.x,
            y: point.totalY,
        }));

        // Solid segment through months that still have actual data
        const lastActualIndex = plotted.reduce((lastIndex, point, index) => {
            if (point.actual > 0) return index;
            return lastIndex;
        }, -1);

        const solidLinePoints =
            lastActualIndex >= 0
                ? forecastLinePoints.slice(0, lastActualIndex + 1)
                : [];

        const dashedLinePoints =
            lastActualIndex >= 0
                ? forecastLinePoints.slice(lastActualIndex)
                : forecastLinePoints;

        const dividerX =
            lastActualIndex >= 0 ? plotted[lastActualIndex].x : null;

        const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
            ratio,
            y: PADDING.top + plotHeight - ratio * plotHeight,
            label: formatForecastNumber(Math.round(maxValue * ratio)),
        }));

        const labelStep = Math.max(1, Math.ceil(points.length / 8));

        return {
            plotted,
            plotWidth,
            plotHeight,
            baselineY,
            gridLines,
            labelStep,
            solidLinePoints,
            dashedLinePoints,
            solidAreaPath: buildAreaPath(solidLinePoints, baselineY),
            dashedAreaPath: buildAreaPath(dashedLinePoints, baselineY),
            solidPath: buildPath(solidLinePoints),
            dashedPath: buildPath(dashedLinePoints),
            dividerX,
            lastActualIndex,
        };
    }, [points]);

    if (!chart) {
        return (
            <div className="rounded-[18px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-10 text-center text-sm text-gray-500">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div
            className="relative w-full overflow-hidden rounded-[20px] border border-[#E4E8E1] bg-[#F8FAF6] px-2 py-3"
            onMouseLeave={() => setTooltip(null)}
        >
            {tooltip && (
                <div
                    className="pointer-events-none absolute z-20 w-[220px] max-w-[calc(100%-24px)] rounded-[16px] border border-[#D2D8CF] bg-white px-4 py-3 shadow-[0_16px_34px_rgba(0,0,0,0.14)]"
                    style={getTooltipStyle(tooltip)}
                >
                    <p className="text-[12px] font-extrabold text-[#4F6F52]">
                        {formatForecastMonthLabel(tooltip.point.month)}
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-[12px]">
                        <div className="flex items-center justify-between gap-4">
                            <span className="font-medium text-gray-500">
                                Aktual
                            </span>
                            <span className="font-bold text-[#4F6F52]">
                                {formatForecastNumber(tooltip.point.actual)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <span className="font-medium text-gray-500">
                                Forecast
                            </span>
                            <span className="font-bold text-[#739072]">
                                {formatForecastNumber(tooltip.point.forecast)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-t border-[#E4E8E1] pt-2">
                            <span className="font-medium text-gray-500">
                                Total
                            </span>
                            <span className="font-extrabold text-black">
                                {formatForecastNumber(tooltip.point.total)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="h-[300px] w-full sm:h-[320px]"
                role="img"
                aria-label="Grafik forecast pengunjung bulanan"
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

                {chart.dividerX !== null && (
                    <g>
                        <line
                            x1={chart.dividerX}
                            x2={chart.dividerX}
                            y1={PADDING.top}
                            y2={PADDING.top + chart.plotHeight}
                            stroke="#B9CDB2"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                        />
                        <text
                            x={chart.dividerX + 6}
                            y={PADDING.top + 14}
                            className="fill-[#5F785F] text-[10px] font-bold"
                        >
                            Forecast →
                        </text>
                    </g>
                )}

                {chart.solidAreaPath && (
                    <path
                        d={chart.solidAreaPath}
                        fill="#4F6F52"
                        opacity={0.12}
                    />
                )}

                {chart.dashedAreaPath && (
                    <path
                        d={chart.dashedAreaPath}
                        fill="#739072"
                        opacity={0.08}
                    />
                )}

                {chart.solidPath && (
                    <path
                        d={chart.solidPath}
                        fill="none"
                        stroke="#4F6F52"
                        strokeWidth={2.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {chart.dashedPath && (
                    <path
                        d={chart.dashedPath}
                        fill="none"
                        stroke="#739072"
                        strokeWidth={2.6}
                        strokeDasharray="7 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {chart.plotted.map((point, index) => {
                    const showLabel =
                        index === 0 ||
                        index === chart.plotted.length - 1 ||
                        index % chart.labelStep === 0;

                    return (
                        <g key={point.month}>
                            {showLabel && (
                                <text
                                    x={point.x}
                                    y={CHART_HEIGHT - 18}
                                    textAnchor="middle"
                                    className="fill-[#5F5F5F] text-[10px] font-semibold sm:text-[11px]"
                                >
                                    {formatForecastMonthShort(point.month)}
                                </text>
                            )}

                            {point.actual > 0 && (
                                <circle
                                    cx={point.x}
                                    cy={point.actualY}
                                    r={4.5}
                                    fill="#4F6F52"
                                    stroke="#FFFFFF"
                                    strokeWidth={2}
                                />
                            )}

                            <circle
                                cx={point.x}
                                cy={point.totalY}
                                r={index > chart.lastActualIndex ? 4 : 3.5}
                                fill={
                                    index > chart.lastActualIndex
                                        ? '#739072'
                                        : '#4F6F52'
                                }
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                opacity={index > chart.lastActualIndex ? 0.95 : 0.35}
                                className="cursor-pointer"
                                onMouseEnter={() =>
                                    setTooltip({
                                        x: point.x,
                                        y: point.totalY,
                                        point: {
                                            month: point.month,
                                            actual: point.actual,
                                            forecast: point.forecast,
                                            total: point.total,
                                        },
                                    })
                                }
                            />

                            <rect
                                x={point.x - 18}
                                y={PADDING.top}
                                width={36}
                                height={chart.plotHeight}
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() =>
                                    setTooltip({
                                        x: point.x,
                                        y: point.totalY,
                                        point: {
                                            month: point.month,
                                            actual: point.actual,
                                            forecast: point.forecast,
                                            total: point.total,
                                        },
                                    })
                                }
                            />
                        </g>
                    );
                })}
            </svg>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-4 px-3 pb-1 text-[11px] font-semibold text-[#5F785F]">
                <div className="flex items-center gap-2">
                    <span className="h-[3px] w-6 rounded-full bg-[#4F6F52]" />
                    Aktual
                </div>
                <div className="flex items-center gap-2">
                    <span className="h-[0px] w-6 border-t-[2.5px] border-dashed border-[#739072]" />
                    Forecast
                </div>
            </div>
        </div>
    );
}
