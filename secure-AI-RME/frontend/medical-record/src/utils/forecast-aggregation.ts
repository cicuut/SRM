export type ForecastHorizon = 3 | 6 | 12;

export interface ChartPoint {
    date: string;
    count: number;
}

export interface ForecastMonthBreakdown {
    month: string;
    actual: number;
    forecast: number;
    total: number;
}

export interface ForecastServiceStats {
    actual_month_to_date: number;
    forecast_remaining_month: number;
    forecast_month_total: number;
    forecast_horizon_total?: number;
    months?: ForecastMonthBreakdown[];
    history: ChartPoint[];
    forecast: ChartPoint[];
    has_model?: boolean;
}

export interface ForecastResponse {
    month: string;
    forecast_end?: string;
    forecast_horizon_months?: number;
    monthly_actual: number;
    monthly_forecast: number;
    forecast_horizon_total?: number;
    months?: ForecastMonthBreakdown[];
    history: ChartPoint[];
    forecast: ChartPoint[];
    by_service: Record<string, ForecastServiceStats>;
}

export interface MonthlyChartPoint {
    month: string;
    actual: number;
    forecast: number;
    total: number;
}

export interface ServiceForecastSummary {
    name: string;
    total: number;
    average: number;
    color: string;
}

export interface MonthlyDetailRow {
    month: string;
    services: Record<string, number>;
    total: number;
}

export const FORECAST_SERVICE_ORDER = [
    'Imunisasi',
    'Kehamilan',
    'Keluarga Berencana',
    'Persalinan',
    'Umum',
] as const;

export const FORECAST_SERVICE_SHORT_LABELS: Record<string, string> = {
    Imunisasi: 'Imunisasi',
    Kehamilan: 'Kehamilan',
    'Keluarga Berencana': 'KB',
    Persalinan: 'Persalinan',
    Umum: 'Umum',
};

export function formatForecastNumber(value: number) {
    return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

export function formatForecastMonthLabel(value?: string | null) {
    if (!value) return '';

    const date = new Date(`${value}-01T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
    });
}

export function formatForecastMonthShort(value?: string | null) {
    if (!value) return '';

    const date = new Date(`${value}-01T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString('id-ID', {
        month: 'short',
        year: '2-digit',
    });
}

/** Compact label for cards, e.g. "AGS 2026" */
export function formatForecastMonthCompact(value?: string | null) {
    if (!value) return '';

    const date = new Date(`${value}-01T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const short = date
        .toLocaleDateString('id-ID', {
            month: 'short',
            year: 'numeric',
        })
        .replace('.', '')
        .toUpperCase();

    return short;
}

export function addMonthsToKey(monthKey: string, offset: number): string {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);

    if (!year || !month) return monthKey;

    const date = new Date(year, month - 1 + offset, 1);
    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() + 1).padStart(2, '0');

    return `${nextYear}-${nextMonth}`;
}

export function buildMonthKeys(startMonth: string, count: number): string[] {
    if (!startMonth || count <= 0) return [];

    return Array.from({ length: count }, (_, index) =>
        addMonthsToKey(startMonth, index),
    );
}

function sumPointsForMonth(points: ChartPoint[] | undefined, monthKey: string) {
    if (!points?.length) return 0;

    return points.reduce((sum, point) => {
        if (!point.date.startsWith(monthKey)) return sum;
        return sum + Number(point.count || 0);
    }, 0);
}

export function sliceForecastMonths(
    months: ForecastMonthBreakdown[] | undefined,
    horizon: ForecastHorizon,
): ForecastMonthBreakdown[] {
    if (!months?.length) return [];
    return months.slice(0, horizon);
}

/**
 * Bangun ringkasan bulanan untuk horizon 3/6/12.
 * Sumber utama: `data.months` dari API (hasil agregasi forecast harian 12 bulan).
 * Selalu mengembalikan tepat `horizon` entri mulai bulan berjalan.
 */
export function resolveHorizonMonths(
    data: ForecastResponse | null | undefined,
    horizon: ForecastHorizon,
): ForecastMonthBreakdown[] {
    if (!data?.month) return [];

    const monthKeys = buildMonthKeys(data.month, horizon);
    const apiByMonth = new Map(
        (data.months || []).map((month) => [
            month.month,
            {
                month: month.month,
                actual: Number(month.actual || 0),
                forecast: Number(month.forecast || 0),
                total: Number(
                    month.total ??
                        Number(month.actual || 0) + Number(month.forecast || 0),
                ),
            },
        ]),
    );

    const services = getModeledServices(data.by_service);

    return monthKeys.map((monthKey) => {
        const fromApi = apiByMonth.get(monthKey);

        // Prefer top-level API month totals — these are built from full-horizon
        // daily predictions on the backend.
        if (fromApi && fromApi.total > 0) {
            return fromApi;
        }

        let actual = 0;
        let forecast = 0;

        for (const [, stats] of services) {
            const serviceMonth = stats.months?.find(
                (month) => month.month === monthKey,
            );

            if (serviceMonth) {
                actual += Number(serviceMonth.actual || 0);
                forecast += Number(serviceMonth.forecast || 0);
                continue;
            }

            actual += sumPointsForMonth(stats.history, monthKey);
            forecast += sumPointsForMonth(stats.forecast, monthKey);
        }

        if (actual === 0 && forecast === 0 && fromApi) {
            return fromApi;
        }

        return {
            month: monthKey,
            actual,
            forecast,
            total: actual + forecast,
        };
    });
}

export function getModeledServices(
    byService: Record<string, ForecastServiceStats> | undefined,
) {
    if (!byService) return [];

    const entries = Object.entries(byService).filter(
        ([, stats]) => stats.has_model !== false,
    );

    return entries.sort(([nameA], [nameB]) => {
        const indexA = FORECAST_SERVICE_ORDER.indexOf(
            nameA as (typeof FORECAST_SERVICE_ORDER)[number],
        );
        const indexB = FORECAST_SERVICE_ORDER.indexOf(
            nameB as (typeof FORECAST_SERVICE_ORDER)[number],
        );

        const safeA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
        const safeB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;

        if (safeA !== safeB) return safeA - safeB;
        return nameA.localeCompare(nameB, 'id');
    });
}

export function buildServiceForecastSummaries(
    data: ForecastResponse | null | undefined,
    horizon: ForecastHorizon,
    colors: Record<string, string>,
    fallbackColors: string[],
): ServiceForecastSummary[] {
    if (!data?.month) return [];

    const monthKeys = buildMonthKeys(data.month, horizon);

    return getModeledServices(data.by_service).map(([name, stats], index) => {
        const total = monthKeys.reduce((sum, monthKey) => {
            const serviceMonth = stats.months?.find(
                (month) => month.month === monthKey,
            );

            if (serviceMonth) {
                return (
                    sum +
                    Number(
                        serviceMonth.total ??
                            Number(serviceMonth.actual || 0) +
                                Number(serviceMonth.forecast || 0),
                    )
                );
            }

            return (
                sum +
                sumPointsForMonth(stats.history, monthKey) +
                sumPointsForMonth(stats.forecast, monthKey)
            );
        }, 0);

        const average =
            monthKeys.length > 0 ? Math.round(total / monthKeys.length) : 0;

        return {
            name,
            total,
            average,
            color:
                colors[name] ||
                fallbackColors[index % fallbackColors.length],
        };
    });
}

export function getForecastKpis(
    months: ForecastMonthBreakdown[],
    serviceSummaries: ServiceForecastSummary[],
    horizon: ForecastHorizon,
) {
    const totalForecast = months.reduce((sum, month) => sum + month.total, 0);
    const divisor = months.length || horizon;
    const averagePerMonth =
        divisor > 0 ? Math.round(totalForecast / divisor) : 0;

    const peakMonth = months.reduce<ForecastMonthBreakdown | null>(
        (best, month) => {
            if (!best || month.total > best.total) return month;
            return best;
        },
        null,
    );

    const topService = serviceSummaries.reduce<ServiceForecastSummary | null>(
        (best, service) => {
            if (!best || service.total > best.total) return service;
            return best;
        },
        null,
    );

    return {
        totalForecast,
        averagePerMonth,
        peakMonth,
        topService,
    };
}
