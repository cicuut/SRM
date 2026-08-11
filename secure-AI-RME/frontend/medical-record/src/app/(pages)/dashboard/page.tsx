'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Cookies from 'js-cookie';
import {
    Activity,
    AlertCircle,
    ArrowUpCircle,
    CalendarDays,
    ClipboardList,
    TrendingUp,
    UserCheck,
    UserPlus,
    UserRound,
    UserX,
    Wallet,
} from 'lucide-react';
import api from '@/utils/app';
import LoadingOverlay from '@/components/loading';
import {
    FinancialChart,
    FinancialChartPoint,
} from '@/components/dashboard/financial-chart';
import { VisitorForecastPanel } from '@/components/dashboard/visitor-forecast-panel';
import { TopAssessmentList } from '@/components/dashboard/top-assessment-list';
import { ForecastResponse } from '@/utils/forecast-aggregation';

type Role = 'admin' | 'midwife' | 'asisten' | '';

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
    role?: string;
    user_role?: string;
    clinic_id?: string | null;
    profile_photo?: string | null;
}

type AuthMeResponse = {
    msg?: string;
    requires_clinic_setup?: boolean;
    redirect_path?: string;
    user: CurrentUser;
};

interface MonthlyFinancialSummary {
    month: string;
    monthly_income: number;
    monthly_expense: number;
    daily_income: FinancialChartPoint[];
    daily_expense: FinancialChartPoint[];
}

interface TopDiagnosisItem {
    rank: number;
    diagnosis: string;
    count: number;
    percentage: number;
    variants?: string[];
}

interface TopDiagnosesResponse {
    month: string;
    total_visits_with_diagnoses: number;
    total_diagnoses_fragments?: number;
    summary?: string;
    top_diagnoses: TopDiagnosisItem[];
    msg?: string;
    error?: string;
}

interface AdminMidwifeItem {
    id: string;
    fullname: string;
    email: string;
    is_active: boolean;
    has_clinic?: boolean;
    created_at?: string | null;
    last_login?: string | null;
}

interface AdminOverviewResponse {
    employees?: AdminMidwifeItem[];
    stats?: {
        total_employees: number;
        active_employees: number;
        inactive_employees: number;
        midwives: number;
    };
}

function normalizeRole(role?: string | null): Role {
    const normalizedRole = String(role || '').trim().toLowerCase();

    if (normalizedRole === 'admin') return 'admin';
    if (normalizedRole === 'developer') return 'admin';

    if (normalizedRole === 'midwife') return 'midwife';
    if (normalizedRole === 'bidan') return 'midwife';
    if (normalizedRole === 'owner') return 'midwife';

    if (normalizedRole === 'asisten') return 'asisten';
    if (normalizedRole === 'assistant') return 'asisten';
    if (normalizedRole === 'staff') return 'asisten';

    return '';
}

function canViewFinancialByRole(role: Role) {
    return role === 'midwife';
}

function formatDisplayRole(role: string): string {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === 'admin') return 'Admin';
    if (normalizedRole === 'midwife') return 'Bidan';
    if (normalizedRole === 'asisten') return 'Asisten';

    if (!role.trim()) return '';

    return role
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map(
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
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
    return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

function formatRupiah(value: number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number(value || 0));
}

function formatMonthLabel(value?: string | null) {
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

function getApiErrorMessage(error: unknown, fallbackMessage: string) {
    const responseData =
        typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (
                error as {
                    response?: {
                        data?: {
                            msg?: string;
                            error?: string;
                        };
                    };
                }
            ).response?.data === 'object'
            ? (
                error as {
                    response?: {
                        data?: {
                            msg?: string;
                            error?: string;
                        };
                    };
                }
            ).response?.data
            : null;

    const message = responseData?.msg;
    const detail = responseData?.error;

    if (message && detail) {
        return `${message}: ${detail}`;
    }

    return message || detail || fallbackMessage;
}

const ErrorNotice = ({ message }: { message: string }) => {
    return (
        <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
            <div className="flex items-start gap-2">
                <AlertCircle className="mt-[1px] h-4 w-4 shrink-0" />
                <p className="leading-relaxed">{message}</p>
            </div>
        </div>
    );
};

const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    tone = 'green',
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ReactNode;
    tone?: 'green' | 'red' | 'gold' | 'blue';
}) => {
    const toneClassName = {
        green: 'bg-[#D2E3C8] text-[#4F6F52]',
        red: 'bg-red-50 text-red-600',
        gold: 'bg-[#FFF4D7] text-[#8A6200]',
        blue: 'bg-blue-50 text-blue-700',
    }[tone];

    return (
        <section className="group relative overflow-hidden rounded-[24px] border border-[#D2D8CF] bg-white px-5 py-5 shadow-sm transition-all duration-300 hover:-translate-y-[2px] hover:border-[#B9CDB2] hover:shadow-md">
            <div className="absolute right-[-42px] top-[-42px] h-[128px] w-[128px] rounded-full bg-[#EEF3E9]" />

            <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#5F785F]">
                        {title}
                    </p>

                    <h3 className="mt-3 break-words text-[18px] font-extrabold leading-tight text-black sm:text-[19px] xl:text-[20px]">
                        {value}
                    </h3>

                    <p className="mt-3 text-[12px] font-medium leading-relaxed text-[#6B6B6B]">
                        {subtitle}
                    </p>
                </div>

                <div
                    className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full ${toneClassName}`}
                >
                    {icon}
                </div>
            </div>
        </section>
    );
};

const SectionCard = ({
    title,
    subtitle,
    icon,
    children,
    className = '',
}: {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) => {
    return (
        <section
            className={`overflow-hidden rounded-[26px] border border-[#D2D8CF] bg-white shadow-sm ${className}`}
        >
            <div className="flex items-start justify-between gap-4 border-b border-[#E4E8E1] bg-[#FDFEF9] px-5 py-5 sm:px-6">
                <div className="min-w-0">
                    <h2 className="text-[20px] font-extrabold leading-tight text-[#4F6F52]">
                        {title}
                    </h2>

                    {subtitle && (
                        <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#6B6B6B]">
                            {subtitle}
                        </p>
                    )}
                </div>

                {icon && (
                    <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[#D2E3C8] text-[#4F6F52]">
                        {icon}
                    </div>
                )}
            </div>

            <div className="px-5 py-5 sm:px-6">{children}</div>
        </section>
    );
};

const Dashboard = () => {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [profilePhoto, setProfilePhoto] = useState('');
    const [storedRole, setStoredRole] = useState<Role>('');
    const [loading, setLoading] = useState(true);

    const [forecastData, setForecastData] =
        useState<ForecastResponse | null>(null);
    const [forecastError, setForecastError] = useState<string | null>(null);

    const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
    const [monthlyExpense, setMonthlyExpense] = useState<number | null>(null);
    const [dailyIncome, setDailyIncome] = useState<FinancialChartPoint[]>([]);
    const [dailyExpense, setDailyExpense] = useState<FinancialChartPoint[]>([]);
    const [financialError, setFinancialError] = useState<string | null>(null);

    const [topDiagnoses, setTopDiagnoses] = useState<TopDiagnosisItem[]>(
        [],
    );
    const [diagnosisMonth, setDiagnosisMonth] = useState<string | null>(null);
    const [diagnosisSummary, setDiagnosisSummary] = useState<string | null>(
        null,
    );
    const [diagnosisVisitCount, setDiagnosisVisitCount] = useState(0);
    const [diagnosisLoading, setDiagnosisLoading] = useState(true);
    const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
    const [adminOverview, setAdminOverview] =
        useState<AdminOverviewResponse | null>(null);
    const [adminError, setAdminError] = useState<string | null>(null);

    const currentRole = normalizeRole(
        currentUser?.role || currentUser?.user_role || storedRole,
    );
    const canViewFinancial = canViewFinancialByRole(currentRole);

    const displayName = currentUser?.fullname?.trim() || '';
    const displayRole = currentRole
        ? formatDisplayRole(currentRole)
        : currentUser?.role
            ? formatDisplayRole(currentUser.role)
            : '';
    const initials = getInitials(displayName);

    // calculate balance
    const netIncome = Number(monthlyIncome || 0) - Number(monthlyExpense || 0);

    const forecastMonthLabel = formatMonthLabel(forecastData?.month);
    const diagnosisMonthLabel = formatMonthLabel(diagnosisMonth);

    const loadLocalProfilePhoto = () => {
        if (typeof window === 'undefined') return;

        setProfilePhoto(localStorage.getItem('profile_photo') || '');
        setStoredRole(normalizeRole(localStorage.getItem('user_role')));
    };

    const saveUserToLocalStorage = (
        user: CurrentUser,
        role: Role,
        requiresClinicSetup?: boolean,
    ) => {
        if (typeof window === 'undefined') return;

        localStorage.setItem('fullname', user.fullname || '');
        localStorage.setItem('user_role', role || '');
        localStorage.setItem('clinic_id', user.clinic_id || '');
        localStorage.setItem(
            'requires_clinic_setup',
            requiresClinicSetup ? 'true' : 'false',
        );
    };

    useEffect(() => {
        let cancelled = false;

        const fetchDashboardData = async () => {
            const token = Cookies.get('access_token');

            loadLocalProfilePhoto();

            if (!token) {
                setLoading(false);
                setDiagnosisLoading(false);
                return;
            }

            try {
                setLoading(true);
                setDiagnosisLoading(true);

                let activeRole = normalizeRole(
                    typeof window !== 'undefined'
                        ? localStorage.getItem('user_role')
                        : '',
                );

                try {
                    const userResponse = await api.get<AuthMeResponse>(
                        '/auth/me',
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        },
                    );

                    if (!cancelled) {
                        const user = userResponse.data.user;
                        activeRole = normalizeRole(
                            user?.role || user?.user_role,
                        );

                        setCurrentUser(user);
                        setStoredRole(activeRole);
                        saveUserToLocalStorage(
                            user,
                            activeRole,
                            userResponse.data.requires_clinic_setup,
                        );

                        const backendProfilePhoto =
                            user?.profile_photo?.trim() || '';

                        if (backendProfilePhoto) {
                            if (typeof window !== 'undefined') {
                                localStorage.setItem(
                                    'profile_photo',
                                    backendProfilePhoto,
                                );
                            }

                            setProfilePhoto(backendProfilePhoto);
                        } else {
                            loadLocalProfilePhoto();
                        }
                    }
                } catch (error) {
                    console.error('Gagal memuat data user:', error);
                }

                if (activeRole === 'admin') {
                    try {
                        const adminResponse = await api.get<AdminOverviewResponse>(
                            '/dashboard/admin-overview',
                        );

                        if (!cancelled) {
                            setAdminOverview(adminResponse.data);
                            setAdminError(null);
                        }
                    } catch (error) {
                        if (!cancelled) {
                            setAdminOverview(null);
                            setAdminError(
                                getApiErrorMessage(
                                    error,
                                    'Gagal memuat ringkasan akun bidan',
                                ),
                            );
                        }
                    }

                    return;
                }

                try {
                    const forecastResponse =
                        await api.get<ForecastResponse>('/dashboard/visitors');

                    if (!cancelled) {
                        setForecastData(forecastResponse.data);
                        setForecastError(null);
                    }
                } catch (error) {
                    console.error('Gagal memuat data forecast:', error);

                    if (!cancelled) {
                        setForecastData(null);
                        setForecastError(
                            getApiErrorMessage(
                                error,
                                'Gagal memuat data perkiraan pengunjung',
                            ),
                        );
                    }
                }

                if (canViewFinancialByRole(activeRole)) {
                    try {
                        const financialResponse =
                            await api.get<MonthlyFinancialSummary>(
                                '/financial/monthly-summary',
                            );

                        if (!cancelled) {
                            setMonthlyIncome(
                                financialResponse.data.monthly_income,
                            );
                            setMonthlyExpense(
                                financialResponse.data.monthly_expense,
                            );
                            setDailyIncome(
                                financialResponse.data.daily_income ?? [],
                            );
                            setDailyExpense(
                                financialResponse.data.daily_expense ?? [],
                            );
                            setFinancialError(null);
                        }
                    } catch (error) {
                        console.error(
                            'Gagal memuat ringkasan keuangan:',
                            error,
                        );

                        if (!cancelled) {
                            setMonthlyIncome(null);
                            setMonthlyExpense(null);
                            setDailyIncome([]);
                            setDailyExpense([]);
                            setFinancialError(
                                getApiErrorMessage(
                                    error,
                                    'Gagal memuat grafik keuangan',
                                ),
                            );
                        }
                    }
                } else if (!cancelled) {
                    setMonthlyIncome(null);
                    setMonthlyExpense(null);
                    setDailyIncome([]);
                    setDailyExpense([]);
                    setFinancialError(null);
                }

                try {
                    const diagnosisResponse =
                        await api.get<TopDiagnosesResponse>(
                            '/dashboard/top-diagnoses',
                        );

                    if (!cancelled) {
                        setTopDiagnoses(
                            diagnosisResponse.data.top_diagnoses ?? [],
                        );
                        setDiagnosisMonth(
                            diagnosisResponse.data.month ?? null,
                        );
                        setDiagnosisSummary(
                            diagnosisResponse.data.summary ?? null,
                        );
                        setDiagnosisVisitCount(
                            diagnosisResponse.data
                                .total_visits_with_diagnoses ?? 0,
                        );
                        setDiagnosisError(null);
                    }
                } catch (error) {
                    console.error('Gagal memuat top diagnosa:', error);

                    if (!cancelled) {
                        setTopDiagnoses([]);
                        setDiagnosisMonth(null);
                        setDiagnosisSummary(null);
                        setDiagnosisVisitCount(0);
                        setDiagnosisError(
                            getApiErrorMessage(
                                error,
                                'Gagal memuat top diagnosa',
                            ),
                        );
                    }
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setDiagnosisLoading(false);
                }
            }
        };

        fetchDashboardData();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (currentRole === 'admin') {
        const stats = adminOverview?.stats;
        const midwives = adminOverview?.employees ?? [];

        return (
            <div className="relative flex w-full min-w-0 flex-col gap-5">
                {loading && <LoadingOverlay />}

                <section className="flex flex-col gap-5 rounded-[28px] border border-[#6F8D70] bg-gradient-to-br from-[#4F6F52] via-[#739072] to-[#86A789] px-6 py-7 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-[24px] font-extrabold sm:text-[30px]">
                            {displayName ? `Hi, ${displayName}!` : 'Dashboard Admin'}
                        </h1>
                        <p className="mt-2 max-w-[650px] text-[13px] font-medium text-white/90 sm:text-[15px]">
                            Pantau jumlah dan status akun Bidan yang terdaftar pada sistem.
                        </p>
                    </div>

                    <Link
                        href="/regist"
                        className="inline-flex h-[42px] items-center justify-center gap-2 rounded-full bg-white px-5 text-[12px] font-bold text-[#4F6F52] shadow-sm hover:bg-[#F1F6EC]"
                    >
                        <UserPlus className="h-4 w-4" />
                        Tambah Bidan
                    </Link>
                </section>

                {adminError && <ErrorNotice message={adminError} />}

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        title="Total Akun Bidan"
                        value={formatNumber(stats?.total_employees ?? 0)}
                        subtitle="Seluruh akun Bidan terdaftar"
                        icon={<UserRound className="h-5 w-5" />}
                        tone="blue"
                    />
                    <StatCard
                        title="Akun Aktif"
                        value={formatNumber(stats?.active_employees ?? 0)}
                        subtitle="Bidan yang dapat login"
                        icon={<UserCheck className="h-5 w-5" />}
                        tone="green"
                    />
                    <StatCard
                        title="Akun Tidak Aktif"
                        value={formatNumber(stats?.inactive_employees ?? 0)}
                        subtitle="Bidan yang tidak dapat login"
                        icon={<UserX className="h-5 w-5" />}
                        tone="red"
                    />
                </section>

                <SectionCard
                    title="Daftar Akun Bidan"
                    subtitle="Informasi akun Bidan yang terdaftar dalam sistem."
                    icon={<UserRound className="h-5 w-5" />}
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left">
                            <thead>
                                <tr className="border-b border-[#E4E8E1] text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                                    <th className="px-3 py-3">Nama Bidan</th>
                                    <th className="px-3 py-3">Email</th>
                                    <th className="px-3 py-3">Klinik</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Tanggal Dibuat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {midwives.map((midwife) => (
                                    <tr
                                        key={midwife.id}
                                        className="border-b border-[#EEF1EC] text-[13px] text-[#303830] last:border-0"
                                    >
                                        <td className="px-3 py-4 font-bold">
                                            {midwife.fullname}
                                        </td>
                                        <td className="px-3 py-4">{midwife.email}</td>
                                        <td className="px-3 py-4">
                                            {midwife.has_clinic ? 'Terhubung' : 'Belum terhubung'}
                                        </td>
                                        <td className="px-3 py-4">
                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold ${midwife.is_active
                                                    ? 'bg-[#D2E3C8] text-[#4F6F52]'
                                                    : 'bg-red-50 text-red-600'
                                                }`}
                                            >
                                                {midwife.is_active ? 'Aktif' : 'Tidak Aktif'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-4">
                                            {midwife.created_at
                                                ? new Date(midwife.created_at).toLocaleDateString('id-ID')
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}

                                {!loading && midwives.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-10 text-center text-[13px] text-gray-500"
                                        >
                                            Belum ada akun Bidan yang terdaftar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            </div>
        );
    }

    return (
        <div className="relative flex w-full min-w-0 flex-col gap-5">
            {loading && <LoadingOverlay />}

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px] w-full">
                <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] border border-[#6F8D70] bg-gradient-to-br from-[#4F6F52] via-[#739072] to-[#86A789] px-4 py-5 sm:px-8 lg:px-9 text-white shadow-sm">
                    <div className="absolute right-[-40px] top-[-40px] sm:right-[-80px] sm:top-[-80px] h-32 w-32 sm:h-[230px] sm:w-[230px] rounded-full bg-white/10" />
                    <div className="absolute bottom-[-50px] left-[10%] sm:bottom-[-95px] sm:left-[35%] h-36 w-36 sm:h-[210px] sm:w-[210px] rounded-full bg-white/10" />
                    <div className="absolute bottom-[28px] right-[220px] hidden h-[72px] w-[72px] rounded-full bg-white/10 lg:block" />

                    <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-[760px]">
                            <h1 className="text-[14px] sm:text-[22px] lg:text-[30px] font-extrabold leading-tight">
                                {displayName
                                    ? `Hi, ${displayName}!`
                                    : 'Hi, Selamat Datang!'}
                            </h1>

                            <p className="mt-2 sm:mt-3 max-w-[660px] text-[12px] sm:text-[15px] lg:text-[20px] font-medium leading-relaxed text-white/90">
                                {canViewFinancial
                                    ? 'Pantau aktivitas klinik, prediksi kunjungan, performa keuangan, dan diagnosa pasien dalam satu dashboard.'
                                    : 'Pantau aktivitas klinik, prediksi kunjungan, dan diagnosa pasien dalam satu dashboard.'}
                            </p>

                            <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-[12px] font-extrabold text-[#4F6F52] shadow-sm">
                                    <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    <DateLabel />
                                </div>
                            </div>
                        </div>

                        {/* Ilustrasi Dokter ikut mengecil */}
                        <div className="hidden shrink-0 lg:block max-w-[140px] xl:max-w-[200px]">
                            <div className="rounded-[24px] bg-white/12 p-4 backdrop-blur">
                                <Image
                                    src="/doctor-icon.png"
                                    alt="Doctor illustration"
                                    width={200}
                                    height={200}
                                    className="w-full h-auto object-contain"
                                    priority
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] border border-[#D2D8CF] bg-white px-4 py-6 sm:px-6 shadow-sm">
                    <div className="absolute right-[-30px] top-[-30px] h-[90px] w-[90px] rounded-full bg-[#EEF3E9]" />
                    <div className="relative z-10 flex h-full flex-row gap-4 sm:flex-col items-center justify-center text-center">
                        <div className="relative flex h-20 w-20 sm:h-[106px] sm:w-[106px] items-center justify-center overflow-hidden rounded-full border-4 border-[#D2E3C8] bg-[#F1F6EC] text-[22px] sm:text-[30px] font-extrabold text-[#4F6F52] shadow-sm">
                            {profilePhoto ? (
                                <img
                                    src={profilePhoto}
                                    alt={displayName ? `Foto profil ${displayName}` : 'Foto profil'}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                initials
                            )}
                        </div>
                        <div className="flex flex-col items-center justify-center gap-1 sm:gap-2">
                        <p className="mt-3 sm:mt-4 max-w-full truncate text-[16px] sm:text-[19px] font-extrabold text-black">
                            {displayName || '\u00A0'}
                        </p>
                        <div className="mt-1.5 sm:mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#D2E3C8] px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-[11px] font-bold text-[#4F6F52]">
                            <UserRound className="h-3.5 w-3.5" />
                            {displayRole || '\u00A0'}
                        </div>
                        </div>
                    </div>
                </div>
            </section>

            <section
                className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${canViewFinancial ? 'xl:grid-cols-4' : 'xl:grid-cols-2'
                    }`}
            >
                <StatCard
                    title="Pengunjung Bulanan"
                    value={
                        forecastData
                            ? `${formatNumber(
                                forecastData.monthly_actual,
                            )} Kunjungan`
                            : forecastError
                                ? '—'
                                : 'Memuat...'
                    }
                    subtitle={
                        forecastMonthLabel
                            ? `Aktual bulan ${forecastMonthLabel}`
                            : 'Total kunjungan aktual bulan ini'
                    }
                    icon={<Activity className="h-5 w-5" />}
                    tone="green"
                />

                <StatCard
                    title="Forecast Bulanan"
                    value={
                        forecastData
                            ? `${formatNumber(
                                forecastData.monthly_forecast,
                            )} Kunjungan`
                            : forecastError
                                ? '—'
                                : 'Memuat...'
                    }
                    subtitle={
                        forecastMonthLabel
                            ? `Estimasi total kunjungan ${forecastMonthLabel}`
                            : 'Estimasi total kunjungan bulan ini'
                    }
                    icon={<TrendingUp className="h-5 w-5" />}
                    tone="blue"
                />

                {canViewFinancial && (
                    <>
                        <StatCard
                            title="Pemasukan"
                            value={
                                monthlyIncome !== null
                                    ? formatRupiah(monthlyIncome)
                                    : financialError
                                        ? '—'
                                        : 'Memuat...'
                            }
                            subtitle="Total pemasukan bulan ini"
                            icon={<ArrowUpCircle className="h-5 w-5" />}
                            tone="green"
                        />

                        <StatCard
                            title="Saldo Bulanan"
                            value={
                                monthlyIncome !== null ||
                                    monthlyExpense !== null
                                    ? formatRupiah(netIncome)
                                    : financialError
                                        ? '—'
                                        : 'Memuat...'
                            }
                            subtitle={`Pengeluaran: ${monthlyExpense !== null
                                ? formatRupiah(monthlyExpense)
                                : financialError
                                    ? '—'
                                    : 'Memuat...'
                                }`}
                            icon={<Wallet className="h-5 w-5" />}
                            tone={netIncome < 0 ? 'red' : 'gold'}
                        />
                    </>
                )}
            </section>

            <VisitorForecastPanel
                data={forecastData}
                error={forecastError}
                loading={loading}
            />

            <section
                className={`grid grid-cols-1 gap-5 ${canViewFinancial
                    ? 'xl:grid-cols-[0.95fr_1.35fr]'
                    : 'xl:grid-cols-1'
                    }`}
            >
                <SectionCard
                    title="Top 5 Diagnosa Bulanan"
                    subtitle={
                        diagnosisSummary ||
                        (diagnosisMonthLabel
                            ? `Diagnosa terbanyak bulan ${diagnosisMonthLabel}.`
                            : 'Diagnosa terbanyak bulan ini.')
                    }
                    icon={<ClipboardList className="h-5 w-5" />}
                    className="min-h-[390px]"
                >
                    {diagnosisError ? (
                        <ErrorNotice message={diagnosisError} />
                    ) : (
                        <TopAssessmentList
                            items={topDiagnoses}
                            isLoading={diagnosisLoading}
                            emptyMessage="Belum ada diagnosa pada kunjungan bulan ini."
                        />
                    )}
                </SectionCard>

                {canViewFinancial && (
                    <SectionCard
                        title="Grafik Keuangan Bulanan"
                        subtitle="Pantau pemasukan dan pengeluaran harian bulan ini."
                        icon={<Wallet className="h-5 w-5" />}
                        className="min-h-[390px]"
                    >
                        {financialError && (
                            <div className="mb-4">
                                <ErrorNotice message={financialError} />
                            </div>
                        )}

                        <FinancialChart
                            title=""
                            income={dailyIncome}
                            expense={dailyExpense}
                            emptyMessage={
                                financialError ||
                                'Belum ada data keuangan bulan ini'
                            }
                        />
                    </SectionCard>
                )}
            </section>
        </div>
    );
};

export default Dashboard;