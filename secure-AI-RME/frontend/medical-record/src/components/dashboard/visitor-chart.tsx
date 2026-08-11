'use client';

/**
 * VisitorChart — grafik kunjungan pasien per layanan (kehamilan, umum, dll.)
 * Menampilkan data aktual (history) dan prediksi (forecast) untuk bulan berjalan.
 * Mendukung tiga mode tampilan: area, line, dan bar (SVG custom, tanpa library chart).
 */

import { useMemo, useState } from 'react';
import {
    fillCountPoints,
    getDaysInMonth,
    toDateKey,
} from '@/utils/chart-month-days';

/** Satu titik data: tanggal (YYYY-MM-DD) dan jumlah kunjungan pada hari itu */
export interface ChartPoint {
    date: string;
    count: number;
}

/** Satu seri layanan: nama, warna, serta data aktual dan forecast */
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

/** Mode visualisasi yang bisa dipilih pengguna */
type ChartMode = 'area' | 'line' | 'bar';

/** Seri layanan setelah tanggal history/forecast dipisah dan diisi ke semua hari bulan */
type DatedServiceSeries = {
    name: string;
    color: string;
    history: ChartPoint[];
    forecast: ChartPoint[];
};

/** Titik pada plot SVG dengan koordinat pixel (x, y) */
type ChartLinePoint = {
    date: string;
    count: number;
    x: number;
    y: number;
};

/** Satu baris di tooltip saat hover titik/bar */
type TooltipItem = {
    label: string;
    value: number;
    color: string;
    type: 'Aktual' | 'Forecast';
};

/** State tooltip: posisi di chart, tanggal, dan daftar nilai per layanan */
type TooltipState = {
    x: number;
    y: number;
    date: string;
    items: TooltipItem[];
};

/** Warna default per nama layanan (sesuai dashboard) */
export const SERVICE_COLORS: Record<string, string> = {
    Kehamilan: '#4F6F52',
    'Keluarga Berencana': '#B8A47E',
    Umum: '#739072',
    Imunisasi: '#86A789',
    Persalinan: '#5F785F',
};

/** Warna cadangan jika layanan tidak ada di SERVICE_COLORS */
const FALLBACK_COLORS = [
    '#4F6F52',
    '#739072',
    '#86A789',
    '#5F785F',
    '#B8A47E',
    '#7C8F65',
];

/** Ukuran viewBox SVG — skala tetap, responsif lewat className w-full */
const CHART_WIDTH = 920;
const CHART_HEIGHT = 280;

/** Ruang kosong di sekitar area plot (sumbu, label) */
const PADDING = {
    top: 22,
    right: 26,
    bottom: 48,
    left: 58,
};

/** Label tanggal lengkap untuk tooltip (locale Indonesia) */
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

/** Label sumbu X: hari + singkat bulan (agar jelas lintas bulan) */
function formatAxisDayLabel(value: string) {
    const parsed = new Date(`${value}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
    });
}

/** Format angka kunjungan dengan pemisah ribuan (id-ID) */
function formatNumber(value: number) {
    return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

/** Membuat path SVG garis (M/L) dari daftar titik {x, y} */
function buildPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';

    return points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');
}

/** Path area: garis atas + tutup ke baseline (sumbu nol) membentuk poligon tertutup */
function buildAreaPath(points: { x: number; y: number }[], baselineY: number) {
    if (points.length === 0) return '';

    const linePath = buildPath(points);
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    return `${linePath} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;
}

/**
 * Posisi tooltip absolut di dalam container relatif.
 * Jika kursor dekat atas chart, tooltip ditampilkan di bawah titik agar tidak terpotong.
 */
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

/** Tombol pemilih mode chart (Area / Line / Bar) */
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

/** Panel tooltip mengambang di atas chart */
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

    /**
     * Menghitung semua geometri chart sekali per perubahan `series`:
     * - Membagi bulan jadi history (≤ hari ini) vs forecast (> hari ini)
     - Mengisi titik kosong per hari via fillCountPoints
     * - Skala Y dari maxCount, koordinat x/y per titik, path SVG
     */
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

        /** Map tanggal → posisi X horizontal di dalam area plot */
        const xForDate = (date: string) => {
            const index = monthDates.indexOf(date);

            if (monthDates.length === 1) {
                return PADDING.left + plotWidth / 2;
            }

            return PADDING.left + (index / (monthDates.length - 1)) * plotWidth;
        };

        /** Map jumlah kunjungan → posisi Y (0 di bawah, maxCount di atas) */
        const yForCount = (count: number) =>
            PADDING.top + plotHeight - (count / maxCount) * plotHeight;

        /** Garis grid horizontal + label sumbu Y (0%, 25%, … 100% dari max) */
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

            // Garis forecast disambung dari titik history terakhir agar tidak putus
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

    // Sumbu X: tampilkan ~8 label hari agar tidak padat
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
                    {/* Latar putih di area plot */}
                    <rect
                        x={PADDING.left}
                        y={PADDING.top}
                        width={chart.plotWidth}
                        height={chart.plotHeight}
                        rx={14}
                        fill="#FFFFFF"
                        opacity={0.68}
                    />

                    {/* Garis grid + label sumbu Y */}
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

                    {/* Label hari di sumbu X (awal, akhir, dan setiap xTickStep) */}
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

                    {/* Mode bar: satu grup bar per layanan, offset horizontal per layanan */}
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

                    {/* Mode area: isian di bawah garis (history lebih gelap, forecast lebih transparan) */}
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

                    {/* Mode area & line: garis + titik interaktif; forecast pakai stroke putus-putus */}
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

                    {/* Garis vertikal penanda saat tooltip aktif */}
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

                {/* Legenda: warna per layanan + arti garis aktual vs forecast */}
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
