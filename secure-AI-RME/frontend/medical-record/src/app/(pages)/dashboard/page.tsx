"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Cookies from "js-cookie";
import api from "@/utils/app";
import LoadingOverlay from "@/components/loading";
import {
  FinancialChart,
  FinancialChartPoint,
} from "@/components/dashboard/financial-chart";
import {
  SERVICE_COLORS,
  ServiceSeries,
  VisitorChart,
} from "@/components/dashboard/visitor-chart";

const FALLBACK_SERVICE_COLORS = [
  "#2563EB",
  "#DC2626",
  "#7C3AED",
  "#EA580C",
  "#0891B2",
];

interface DateLabelProps {
  className?: string;
  emptyValue?: string;
}

export const DateLabel = ({
  className,
  emptyValue = "\u00A0",
}: DateLabelProps) => {
  const [dateLabel, setDateLabel] = useState<string>("");

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  useEffect(() => {
    setDateLabel(dateFormatter.format(new Date()));
  }, [dateFormatter]);

  return <p className={className}>{dateLabel || emptyValue}</p>;
};

interface CurrentUser {
  fullname: string;
  role: string;
}

interface ChartPoint {
  date: string;
  count: number;
}

interface ForecastResponse {
  month: string;
  monthly_actual: number;
  monthly_forecast: number;
  history: ChartPoint[];
  forecast: ChartPoint[];
  by_service: Record<
    string,
    {
      actual_month_to_date: number;
      forecast_remaining_month: number;
      forecast_month_total: number;
      history: ChartPoint[];
      forecast: ChartPoint[];
      has_model?: boolean;
    }
  >;
}

function formatDisplayRole(role: string): string {
  if (!role.trim()) return "";
  return role
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

interface MonthlyFinancialSummary {
  month: string;
  monthly_income: number;
  monthly_expense: number;
  daily_income: FinancialChartPoint[];
  daily_expense: FinancialChartPoint[];
}

const Dashboard = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(
    null,
  );
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
  const [monthlyExpense, setMonthlyExpense] = useState<number | null>(null);
  const [dailyIncome, setDailyIncome] = useState<FinancialChartPoint[]>([]);
  const [dailyExpense, setDailyExpense] = useState<FinancialChartPoint[]>([]);
  const [financialError, setFinancialError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = Cookies.get("access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const userResponse = await api.get<{ user: CurrentUser }>("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          setCurrentUser(userResponse.data.user);
        }
      } catch (err) {
        console.error("Failed to load current user:", err);
      }

      try {
        const forecastResponse =
          await api.get<ForecastResponse>("/forecast/visitors");
        if (!cancelled) {
          setForecastData(forecastResponse.data);
          setForecastError(null);
        }
      } catch (err: unknown) {
        console.error("Failed to load forecast data:", err);
        if (!cancelled) {
          const apiMessage =
            typeof err === "object" &&
            err !== null &&
            "response" in err &&
            typeof (err as { response?: { data?: { msg?: string; error?: string } } })
              .response?.data?.msg === "string"
              ? (err as { response: { data: { msg: string; error?: string } } })
                  .response.data.msg
              : null;
          const apiDetail =
            typeof err === "object" &&
            err !== null &&
            "response" in err &&
            typeof (err as { response?: { data?: { error?: string } } }).response
              ?.data?.error === "string"
              ? (err as { response: { data: { error: string } } }).response.data
                  .error
              : null;
          setForecastError(
            apiDetail
              ? `${apiMessage ?? "Gagal memuat data perkiraan pengunjung"}: ${apiDetail}`
              : apiMessage ?? "Gagal memuat data perkiraan pengunjung",
          );
        }
      }

      try {
        const financialResponse = await api.get<MonthlyFinancialSummary>(
          "/financial/monthly-summary",
        );
        if (!cancelled) {
          setMonthlyIncome(financialResponse.data.monthly_income);
          setMonthlyExpense(financialResponse.data.monthly_expense);
          setDailyIncome(financialResponse.data.daily_income ?? []);
          setDailyExpense(financialResponse.data.daily_expense ?? []);
          setFinancialError(null);
        }
      } catch (err: unknown) {
        console.error("Failed to load monthly financial summary:", err);
        if (!cancelled) {
          const apiMessage =
            typeof err === "object" &&
            err !== null &&
            "response" in err &&
            typeof (err as { response?: { data?: { msg?: string; error?: string } } })
              .response?.data?.msg === "string"
              ? (err as { response: { data: { msg: string; error?: string } } })
                  .response.data.msg
              : null;
          const apiDetail =
            typeof err === "object" &&
            err !== null &&
            "response" in err &&
            typeof (err as { response?: { data?: { error?: string } } }).response
              ?.data?.error === "string"
              ? (err as { response: { data: { error: string } } }).response.data.error
              : null;
          setMonthlyIncome(null);
          setMonthlyExpense(null);
          setDailyIncome([]);
          setDailyExpense([]);
          setFinancialError(
            apiDetail
              ? `${apiMessage ?? "Gagal memuat grafik keuangan"}: ${apiDetail}`
              : apiMessage ?? "Gagal memuat grafik keuangan",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = currentUser?.fullname?.trim() || "";
  const displayRole = currentUser?.role
    ? formatDisplayRole(currentUser.role)
    : "";

  const forecastServices = forecastData
    ? Object.entries(forecastData.by_service)
    : [];

  const visitorChartSeries: ServiceSeries[] = forecastData
    ? Object.entries(forecastData.by_service)
        .filter(([, data]) => data.has_model !== false)
        .map(([name, data]) => ({
          name,
          history: data.history,
          forecast: data.forecast,
          color: "",
        }))
    : [];

  return (
    <div>
      <div className="flex w-full flex-1 flex-col">
        {loading && <LoadingOverlay />}
        <div className="ml-5 mt-5 flex flex-col gap-y-[25px]">
          <div className="flex w-full gap-x-[20px]">
            <div className="flex w-sm flex-1 flex-row gap-x-[30] rounded-[30px] bg-[#739072] px-8 py-5 pb-[0] text-white">
              <div className="flex w-sm flex-1 flex-col gap-y-[10]">
                <h1 className="text-[25px] font-bold">
                  {displayName ? `Hi, ${displayName}!` : "Hi!"}
                </h1>
                <p className="text-[20px]">
                  Selamat Datang Kembali di Sistem Informasi dan Manajemen
                  Klinik.{" "}
                </p>
                <DateLabel className="text-[20px]" />
              </div>
              <div className="illustration">
                <Image
                  src="/doctor-icon.png"
                  alt="img"
                  width={160}
                  height={160}
                />
              </div>
            </div>
            <div className="w-md flex flex-col items-center gap-y-[5px] rounded-[30px] bg-[#739072] px-8 py-5 pb-[0] text-[15px] text-white">
              <Image
                src="/user.png"
                alt="img"
                width={80}
                height={80}
                className="rounded-[50px]"
              />
              <p>{displayName || "\u00A0"}</p>
              <p>{displayRole || "\u00A0"}</p>
            </div>
          </div>
          <div className="flex gap-x-[40px]">
            <div className="flex-1 rounded-[10px] bg-[#FFFFFF] px-7 py-6 text-center drop-shadow-lg">
              <h3 className="text-[20px]">Total Pengunjung Bulanan</h3>
              <p className="text-[20px] font-bold">
                {forecastData
                  ? `${formatNumber(forecastData.monthly_actual)} Kunjungan`
                  : forecastError || "Memuat..."}
              </p>
            </div>
            <div className="flex-1 rounded-[10px] bg-[#FFFFFF] px-7 py-6 text-center drop-shadow-lg">
              <h3 className="text-[20px]">Total Pemasukan Bulanan</h3>
              <p className="text-[20px] font-bold">
                {monthlyIncome !== null
                  ? formatRupiah(monthlyIncome)
                  : loading
                    ? "Memuat..."
                    : "—"}
              </p>
            </div>
            <div className="flex-1 rounded-[10px] bg-[#FFFFFF] px-7 py-6 text-center drop-shadow-lg">
              <h3 className="text-[20px]">Total Pengeluaran Bulanan</h3>
              <p className="text-[20px] font-bold">
                {monthlyExpense !== null
                  ? formatRupiah(monthlyExpense)
                  : loading
                    ? "Memuat..."
                    : "—"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex w-full flex-col gap-6">
            <div className="min-h-[240px] w-full rounded-[10px] bg-[#FFFFFF] px-5 py-6 drop-shadow-lg">
              <VisitorChart
                title="Grafik Pengunjung Bulanan"
                series={visitorChartSeries}
                emptyMessage={
                  forecastError ||
                  "Belum ada data kunjungan untuk layanan yang dimodelkan"
                }
              />
            </div>

            <div className="flex w-full flex-col gap-6 lg:flex-row">
              <div className="min-w-0 w-full shrink-0 rounded-[10px] bg-[#FFFFFF] px-5 py-6 drop-shadow-lg lg:w-[42%] lg:max-w-xl">
              <h2 className="text-xl font-semibold text-[#4F6F52]">
                Perkiraan Pengunjung Bulanan
              </h2>
              {forecastError && (
                <p className="mt-4 text-sm text-red-500">{forecastError}</p>
              )}
              {!forecastError && forecastServices.length === 0 && !loading && (
                <p className="mt-4 text-sm text-gray-500">
                  Belum ada data untuk menghitung perkiraan.
                </p>
              )}
              <div className="mt-5 flex flex-row flex-wrap gap-4">
                {forecastServices.map(([service, stats], index) => {
                  const accentColor =
                    SERVICE_COLORS[service] ??
                    FALLBACK_SERVICE_COLORS[
                      index % FALLBACK_SERVICE_COLORS.length
                    ];

                  return (
                    <div
                      key={service}
                      className="min-w-[250px] flex-1 rounded-lg border border-[#E6EDE5] bg-[#FDFEF9] px-4 py-3 text-left"
                      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
                    >
                      <p
                        className="text-sm font-semibold"
                        style={{ color: accentColor }}
                      >
                        {service}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        Aktual: {formatNumber(stats.actual_month_to_date)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Sisa bulan:{" "}
                        {formatNumber(stats.forecast_remaining_month)}
                      </p>
                      {stats.has_model === false ? (
                        <p className="mt-2 text-xs text-gray-500">
                          Belum ada model prediksi
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-gray-600">
                          Total perkiraan:{" "}
                          <span
                            className="font-medium"
                            style={{ color: accentColor }}
                          >
                            {formatNumber(stats.forecast_month_total)}
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {forecastData && (
                <p className="mt-5 w-full border-t border-[#E6EDE5] pt-4 text-xs text-gray-600">
                  Total semua layanan:{" "}
                  <span className="font-medium text-[#4F6F52]">
                    {formatNumber(forecastData.monthly_forecast)} kunjungan
                  </span>
                </p>
              )}
              </div>

              <div className="min-h-[280px] min-w-0 flex-1 rounded-[10px] bg-[#FFFFFF] px-5 py-6 drop-shadow-lg">
                <h2 className="text-xl font-semibold text-[#4F6F52]">
                  Top 5 Diagnosa Bulanan
                </h2>
                <p className="mt-4 text-sm text-gray-500">
                  Data diagnosa akan dilist di sini.
                </p>
              </div>
            </div>

            <div className="min-h-[240px] w-full rounded-[10px] bg-[#FFFFFF] px-5 py-6 drop-shadow-lg">
              <FinancialChart
                title="Grafik Keuangan Bulanan"
                income={dailyIncome}
                expense={dailyExpense}
                emptyMessage={
                  financialError || "Belum ada data keuangan bulan ini"
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
