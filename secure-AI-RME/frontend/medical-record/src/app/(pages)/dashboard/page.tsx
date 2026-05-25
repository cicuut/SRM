'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Cookies from 'js-cookie';
import api from '@/utils/app';
import LoadingOverlay from '@/components/loading';
import {
  FinancialChart,
  FinancialChartPoint,
} from "@/components/dashboard/financial-chart";
import {
  SERVICE_COLORS,
  ServiceSeries,
  VisitorChart,
} from "@/components/dashboard/visitor-chart";
import { TopAssessmentList } from "@/components/dashboard/top-assessment-list";

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
    emptyValue = '\u00A0',
}: DateLabelProps) => {
    const [dateLabel, setDateLabel] = useState<string>('');

    const dateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat('id-ID', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
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
    profile_photo?: string | null;
}

type AuthMeResponse = {
    user: CurrentUser;
};

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
    if (!role.trim()) return '';

    if (role === 'asisten') return 'Asisten';

    return role
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function getInitials(name: string): string {
    const initials = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return initials || 'U';
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

/** Satu item ranking dari API Top Diagnosa (backend: assessment_service.py) */
interface TopAssessmentItem {
  rank: number;
  assessment: string;
  diagnosis?: string;
  count: number;
  percentage: number;
  variants?: string[];
  source?: "canonical" | "cluster" | "singleton" | "fuzzy";
}

/** Response GET /api/dashboard/top-assessments */
interface TopAssessmentsResponse {
  month: string;
  grouping_method?: string;
  total_visits_with_assessment: number;
  summary?: string;
  top_diagnoses?: TopAssessmentItem[];
  top_assessments: TopAssessmentItem[];
  msg?: string;
  error?: string;
}

const Dashboard = () => {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [profilePhoto, setProfilePhoto] = useState('');
    const [loading, setLoading] = useState(true);

    const displayName = currentUser?.fullname?.trim() || '';
    const displayRole = currentUser?.role
        ? formatDisplayRole(currentUser.role)
        : '';
    const initials = getInitials(displayName);

    const loadLocalProfilePhoto = () => {
        setProfilePhoto(localStorage.getItem('profile_photo') || '');
    };

    const [forecastData, setForecastData] = useState<ForecastResponse | null>(
    null,
  );
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
  const [monthlyExpense, setMonthlyExpense] = useState<number | null>(null);
  const [dailyIncome, setDailyIncome] = useState<FinancialChartPoint[]>([]);
  const [dailyExpense, setDailyExpense] = useState<FinancialChartPoint[]>([]);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [topAssessments, setTopAssessments] = useState<TopAssessmentItem[]>([]);
  const [assessmentMonth, setAssessmentMonth] = useState<string | null>(null);
  const [assessmentSummary, setAssessmentSummary] = useState<string | null>(null);
  const [assessmentVisitCount, setAssessmentVisitCount] = useState(0);
  const [assessmentLoading, setAssessmentLoading] = useState(true);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  useEffect(() => {
        let cancelled = false;

        const token = Cookies.get('access_token');

        loadLocalProfilePhoto();

        if (!token) {
              setLoading(false);
              return;
          }

        const fetchCurrentUser = async () => {
            try {
                const userResponse = await api.get<AuthMeResponse>('/auth/me', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (cancelled) {
                    return;
                }

                const user = userResponse.data.user;
                if (!user) {
                    return;
                }

                setCurrentUser(user);

                const backendProfilePhoto = user.profile_photo?.trim() || '';

                if (backendProfilePhoto) {
                    localStorage.setItem('profile_photo', backendProfilePhoto);
                    setProfilePhoto(backendProfilePhoto);
                } else {
                    localStorage.removeItem('profile_photo');
                    setProfilePhoto('');
                }
            } catch (error) {
                console.error('Failed to load current user:', error);
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

      // Top 5 diagnosa: backend normalisasi hibrida (aturan + clustering)
      try {
        setAssessmentLoading(true);
        const assessmentResponse = await api.get<TopAssessmentsResponse>(
          "/dashboard/top-assessments",
        );
        if (!cancelled) {
          setTopAssessments(
            assessmentResponse.data.top_diagnoses ??
              assessmentResponse.data.top_assessments ??
              [],
          );
          setAssessmentMonth(assessmentResponse.data.month ?? null);
          setAssessmentSummary(assessmentResponse.data.summary ?? null);
          setAssessmentVisitCount(
            assessmentResponse.data.total_visits_with_assessment ?? 0,
          );
          setAssessmentError(null);
        }
      } catch (err: unknown) {
        console.error("Failed to load top assessments:", err);
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
          setTopAssessments([]);
          setAssessmentMonth(null);
          setAssessmentSummary(null);
          setAssessmentVisitCount(0);
          setAssessmentError(
            apiDetail
              ? `${apiMessage ?? "Gagal memuat top assessment"}: ${apiDetail}`
              : apiMessage ?? "Gagal memuat top assessment",
          );
        }
      } finally {
        if (!cancelled) {
          setAssessmentLoading(false);
        }
      }
        };

        fetchCurrentUser();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const handleProfilePhotoUpdated = () => {
            loadLocalProfilePhoto();
        };

        const handleStorageChange = () => {
            loadLocalProfilePhoto();
        };

        window.addEventListener(
            'profile-photo-updated',
            handleProfilePhotoUpdated,
        );
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('focus', handleProfilePhotoUpdated);

        return () => {
            window.removeEventListener(
                'profile-photo-updated',
                handleProfilePhotoUpdated,
            );
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('focus', handleProfilePhotoUpdated);
        };
    }, []);

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
              <div className="flex h-[80px] w-[80px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FDFEF9] text-[22px] font-bold text-[#5F785F]">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt={displayName ? `Foto profil ${displayName}` : "Foto profil"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
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
                      className="min-w-[240px] flex-1 rounded-lg border border-[#E6EDE5] bg-[#FDFEF9] px-4 py-3 text-left"
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
                <p className="mt-1 text-xs text-gray-500">
                  Hibrida: aturan medis + clustering teks (assessment &amp;
                  keluhan KB)
                </p>
                {assessmentError ? (
                  <p className="mt-4 text-sm text-red-500">{assessmentError}</p>
                ) : (
                  <TopAssessmentList
                    month={assessmentMonth}
                    totalVisits={assessmentVisitCount}
                    items={topAssessments}
                    isLoading={assessmentLoading}
                    emptyMessage="Belum ada diagnosa pada kunjungan bulan ini."
                  />
                )}
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