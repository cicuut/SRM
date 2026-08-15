'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
    Activity,
    ChartNoAxesCombined,
    LineChart,
    Sparkles,
    TrendingUp,
} from 'lucide-react';
import {
    SERVICE_COLORS,
    VisitorChart,
    type ServiceSeries,
} from '@/components/dashboard/visitor-chart';
import {
    buildServiceForecastSummaries,
    ForecastHorizon,
    ForecastResponse,
    formatForecastMonthCompact,
    formatForecastMonthLabel,
    formatForecastMonthShort,
    formatForecastNumber,
    getForecastKpis,
    getModeledServices,
    resolveHorizonMonths,
} from '@/utils/forecast-aggregation';

const FALLBACK_COLORS = [
    '#4F6F52',
    '#739072',
    '#86A789',
    '#5F785F',
    '#B8A47E',
];

const HORIZON_OPTIONS: ForecastHorizon[] = [3, 6, 12];

interface VisitorForecastPanelProps {
    data: ForecastResponse | null;
    error?: string | null;
    loading?: boolean;
}

const PeriodToggle = ({
    value,
    onChange,
}: {
    value: ForecastHorizon;
    onChange: (value: ForecastHorizon) => void;
}) => {
    return (
        <div className="flex w-fit flex-wrap items-center gap-1 rounded-full border border-[#D2D8CF] bg-[#F8FAF6] p-1">
            {HORIZON_OPTIONS.map((option) => {
                const isActive = value === option;

                return (
                    <button
                        key={option}
                        type="button"
                        onClick={() => onChange(option)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
                            isActive
                                ? 'bg-[#739072] text-white shadow-sm'
                                : 'bg-white text-[#5F785F] hover:bg-[#EEF3E9]'
                        }`}
                    >
                        {option} Bulan
                    </button>
                );
            })}
        </div>
    );
};

const ForecastKpiCard = ({
    title,
    value,
    subtitle,
    icon,
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: ReactNode;
}) => {
    return (
        <div className="rounded-[20px] border border-[#D2D8CF] bg-white px-4 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5F785F]">
                        {title}
                    </p>
                    <p className="mt-2 truncate text-[20px] font-extrabold leading-none text-black sm:text-[22px]">
                        {value}
                    </p>
                    <p className="mt-2 text-[11px] font-medium leading-relaxed text-[#6B6B6B]">
                        {subtitle}
                    </p>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D2E3C8] text-[#4F6F52]">
                    {icon}
                </div>
            </div>
        </div>
    );
};

function filterPointsByMonthKey<T extends { date: string }>(
    points: T[] | undefined,
    monthKey: string,
): T[] {
    if (!points?.length || !monthKey) return [];
    return points.filter((point) => point.date.startsWith(monthKey));
}

export function VisitorForecastPanel({
    data,
    error = null,
    loading = false,
}: VisitorForecastPanelProps) {
    const [horizon, setHorizon] = useState<ForecastHorizon>(3);

    const currentMonthKey = data?.month || '';

    const dailySeries: ServiceSeries[] = useMemo(() => {
        if (!data?.by_service || !currentMonthKey) return [];

        return getModeledServices(data.by_service).map(([name, stats], index) => ({
            name,
            history: filterPointsByMonthKey(stats.history, currentMonthKey),
            forecast: filterPointsByMonthKey(stats.forecast, currentMonthKey),
            color:
                SERVICE_COLORS[name] ||
                FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        }));
    }, [data?.by_service, currentMonthKey]);

    const visibleMonths = useMemo(
        () => resolveHorizonMonths(data, horizon),
        [data, horizon],
    );

    const serviceSummaries = useMemo(
        () =>
            buildServiceForecastSummaries(
                data,
                horizon,
                SERVICE_COLORS,
                FALLBACK_COLORS,
            ),
        [data, horizon],
    );

    const kpis = useMemo(
        () => getForecastKpis(visibleMonths, serviceSummaries, horizon),
        [visibleMonths, serviceSummaries, horizon],
    );

    const maxMonthTotal = Math.max(
        ...visibleMonths.map((month) => month.total),
        1,
    );

    const maxServiceTotal = Math.max(
        ...serviceSummaries.map((service) => service.total),
        1,
    );

    const currentMonthLabel = formatForecastMonthLabel(currentMonthKey);
    const periodStartLabel = visibleMonths[0]
        ? formatForecastMonthLabel(visibleMonths[0].month)
        : '';
    const periodEndLabel = visibleMonths[visibleMonths.length - 1]
        ? formatForecastMonthLabel(visibleMonths[visibleMonths.length - 1].month)
        : '';

    if (error) {
        return (
            <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
                {error}
            </div>
        );
    }

    if (!data && loading) {
        return (
            <div className="rounded-[18px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-10 text-center text-sm text-gray-500">
                Memuat data forecast...
            </div>
        );
    }

    if (!data) {
        return (
            <div className="rounded-[18px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-10 text-center text-sm text-gray-500">
                Belum ada data untuk menghitung perkiraan.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <section className="overflow-hidden rounded-[26px] border border-[#D2D8CF] bg-white shadow-sm">
                <div className="flex items-start justify-between gap-4 border-b border-[#E4E8E1] bg-[#FDFEF9] px-5 py-5 sm:px-6">
                    <div className="min-w-0">
                        <h2 className="text-[20px] font-extrabold leading-tight text-[#4F6F52]">
                            Grafik Pengunjung
                        </h2>
                        <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#6B6B6B]">
                            Perbandingan kunjungan aktual dan prediksi untuk
                            bulan berjalan
                            {currentMonthLabel ? ` (${currentMonthLabel})` : ''}
                            .
                        </p>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D2E3C8] text-[#4F6F52]">
                        <LineChart className="h-5 w-5" />
                    </div>
                </div>

                <div className="px-5 py-5 sm:px-6">
                    <VisitorChart
                        title=""
                        series={dailySeries}
                        emptyMessage="Belum ada data kunjungan untuk layanan yang dimodelkan"
                    />
                </div>
            </section>

            <section className="overflow-hidden rounded-[26px] border border-[#D2D8CF] bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-[#E4E8E1] bg-[#FDFEF9] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                    <div className="min-w-0">
                        <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D2E3C8] text-[#4F6F52]">
                                <ChartNoAxesCombined className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-[20px] font-extrabold leading-tight text-[#4F6F52]">
                                    Perkiraan Pengunjung
                                </h2>
                                <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#6B6B6B]">
                                    Ringkasan prediksi kunjungan berdasarkan
                                    periode.
                                    {periodStartLabel && periodEndLabel
                                        ? ` Menampilkan ${horizon} bulan: ${periodStartLabel} – ${periodEndLabel}.`
                                        : ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    <PeriodToggle value={horizon} onChange={setHorizon} />
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <ForecastKpiCard
                            title="Total Forecast"
                            value={formatForecastNumber(kpis.totalForecast)}
                            subtitle={`Jumlah prediksi ${visibleMonths.length} bulan terpilih`}
                            icon={<TrendingUp className="h-4 w-4" />}
                        />
                        <ForecastKpiCard
                            title="Rata-rata / Bulan"
                            value={formatForecastNumber(kpis.averagePerMonth)}
                            subtitle={`Total forecast ÷ ${visibleMonths.length || horizon} bulan`}
                            icon={<Activity className="h-4 w-4" />}
                        />
                        <ForecastKpiCard
                            title="Layanan Tertinggi"
                            value={kpis.topService?.name || '—'}
                            subtitle={
                                kpis.topService
                                    ? `${formatForecastNumber(kpis.topService.total)} pasien selama ${horizon} bulan`
                                    : 'Layanan dengan prediksi kunjungan tertinggi'
                            }
                            icon={<Sparkles className="h-4 w-4" />}
                        />
                    </div>

                    <div>
                        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                            Forecast per bulan ({visibleMonths.length} bulan)
                        </p>

                        <div
                            className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${
                                horizon >= 12
                                    ? 'xl:grid-cols-4'
                                    : horizon === 6
                                      ? 'xl:grid-cols-6'
                                      : 'xl:grid-cols-3'
                            }`}
                        >
                            {visibleMonths.map((month) => (
                                <div
                                    key={month.month}
                                    className="rounded-[14px] border border-[#E6EDE5] bg-[#FDFEF9] px-3 py-3"
                                >
                                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400">
                                        {formatForecastMonthCompact(month.month)}
                                    </p>
                                    <p className="mt-1.5 text-[17px] font-extrabold text-[#4F6F52]">
                                        {formatForecastNumber(month.total)}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-gray-500">
                                        Total forecast
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 rounded-[18px] border border-[#E6EDE5] bg-[#F8FAF6] px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                            Perbandingan per bulan ({visibleMonths.length}{' '}
                            bulan)
                        </p>

                        {visibleMonths.map((month) => {
                            const widthPercent = Math.max(
                                4,
                                Math.round((month.total / maxMonthTotal) * 100),
                            );

                            return (
                                <div
                                    key={`bar-${month.month}`}
                                    className="grid grid-cols-[68px_1fr_auto] items-center gap-3 sm:grid-cols-[76px_1fr_auto]"
                                >
                                    <p className="truncate text-[11px] font-semibold text-[#4F6F52]">
                                        {formatForecastMonthShort(month.month)}
                                    </p>
                                    <div className="h-2 overflow-hidden rounded-full bg-[#E8EEE4]">
                                        <div
                                            className="h-full rounded-full bg-[#739072] transition-all"
                                            style={{ width: `${widthPercent}%` }}
                                        />
                                    </div>
                                    <p className="min-w-[44px] text-right text-[11px] font-bold text-gray-600">
                                        {formatForecastNumber(month.total)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-[26px] border border-[#D2D8CF] bg-white shadow-sm">
                <div className="border-b border-[#E4E8E1] bg-[#FDFEF9] px-5 py-5 sm:px-6">
                    <h2 className="text-[20px] font-extrabold leading-tight text-[#4F6F52]">
                        Forecast Berdasarkan Layanan
                    </h2>
                    <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#6B6B6B]">
                        Total forecast selama {horizon} bulan
                        {periodStartLabel && periodEndLabel
                            ? ` (${periodStartLabel} – ${periodEndLabel})`
                            : ''}{' '}
                        berdasarkan jenis layanan.
                    </p>
                </div>

                <div className="space-y-3 px-5 py-5 sm:px-6">
                    {serviceSummaries.map((service) => {
                        const widthPercent = Math.max(
                            6,
                            Math.round((service.total / maxServiceTotal) * 100),
                        );

                        return (
                            <div
                                key={service.name}
                                className="rounded-[18px] border border-[#E6EDE5] bg-[#FDFEF9] px-4 py-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p
                                            className="truncate text-[13px] font-extrabold"
                                            style={{ color: service.color }}
                                        >
                                            {service.name}
                                        </p>
                                        <p className="mt-1 text-[12px] font-medium text-gray-500">
                                            Rata-rata{' '}
                                            {formatForecastNumber(service.average)}
                                            /bulan
                                        </p>
                                    </div>

                                    <p
                                        className="shrink-0 text-[17px] font-extrabold"
                                        style={{ color: service.color }}
                                    >
                                        {formatForecastNumber(service.total)}
                                        <span className="ml-1 text-[11px] font-semibold text-gray-500">
                                            pasien
                                        </span>
                                    </p>
                                </div>

                                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#E8EEE4]">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${widthPercent}%`,
                                            backgroundColor: service.color,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
