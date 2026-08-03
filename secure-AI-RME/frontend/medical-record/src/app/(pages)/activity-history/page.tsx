'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Filter,
    Search,
} from 'lucide-react';
import LoadingOverlay from '@/components/loading';
import api from '@/utils/app';

type MeResponse = {
    msg?: string;
    requires_clinic_setup?: boolean;
    redirect_path?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role?: string;
        user_role?: string;
        clinic_id?: string | null;
        is_active?: boolean;
    };
};

type Role = 'admin' | 'midwife' | 'asisten' | '';

const normalizeRole = (role?: string | null): Role => {
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
};

const canAccessActivityHistory = (role: Role) => {
    return role === 'admin' || role === 'midwife';
};

const translateMessage = (message?: string) => {
    const rawMessage = String(message || '').trim();

    if (!rawMessage) {
        return 'Terjadi kesalahan. Silakan coba lagi.';
    }

    const normalizedMessage = rawMessage.toLowerCase();

    if (normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('network error')) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    if (normalizedMessage.includes('user not found')) {
        return 'User tidak ditemukan.';
    }

    if (normalizedMessage.includes('account is inactive') || normalizedMessage.includes('inactive')) {
        return 'Akun Anda sedang tidak aktif.';
    }

    if (
        normalizedMessage.includes('access denied') ||
        normalizedMessage.includes('only admin') ||
        normalizedMessage.includes('only admin and midwife') ||
        normalizedMessage.includes('forbidden')
    ) {
        return 'Kamu tidak memiliki izin untuk mengakses Activity History.';
    }

    if (normalizedMessage.includes('invalid date format')) {
        return 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.';
    }

    if (normalizedMessage.includes('failed to get') || normalizedMessage.includes('gagal mengambil')) {
        return 'Gagal mengambil data Activity History.';
    }

    return rawMessage;
};

type AuditLog = {
    audit_id: string;
    audit_number: string;
    date_time: string;
    user: string;
    user_email: string;
    action: string;
    module: string;
    record_id: string;
    old_value: string;
    new_value: string;
};

type TableKey =
    | 'audit_number'
    | 'date_time'
    | 'user'
    | 'action'
    | 'module'
    | 'record_id'
    | 'old_value'
    | 'new_value';

type TableHeader = {
    label: string;
    key: TableKey;
};

type CalendarDay = {
    dateString: string;
    dayNumber: number;
    isCurrentMonth: boolean;
};

const tableHeaders: TableHeader[] = [
    { label: 'ID Audit', key: 'audit_number' },
    { label: 'Tanggal', key: 'date_time' },
    { label: 'Pengguna', key: 'user' },
    { label: 'Aksi', key: 'action' },
    { label: 'Module', key: 'module' },
    { label: 'Record ID', key: 'record_id' },
    { label: 'Data Lama', key: 'old_value' },
    { label: 'Data Baru', key: 'new_value' },
];

const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
];

const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const getTodayInputValue = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

    return date.toISOString().split('T')[0];
};

const toInputDateValue = (date: Date) => {
    const clonedDate = new Date(date);
    clonedDate.setMinutes(
        clonedDate.getMinutes() - clonedDate.getTimezoneOffset(),
    );

    return clonedDate.toISOString().split('T')[0];
};



const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Semua Tanggal';

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return 'Tanggal Tidak Valid';
    }

    return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
};

const formatDateTime = (value: string) => {
    if (!value) return '-';

    const date = new Date(value.replace(' ', 'T'));

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const normalizeDateFromDateTime = (value: string) => {
    if (!value) return '';

    if (value.includes('T')) return value.split('T')[0];
    if (value.includes(' ')) return value.split(' ')[0];

    return value;
};

const getAuditLogTimestamp = (value: string) => {
    if (!value) return 0;

    const normalizedValue = value.includes(' ')
        ? value.replace(' ', 'T')
        : value;

    const timestamp = new Date(normalizedValue).getTime();

    if (!Number.isNaN(timestamp)) {
        return timestamp;
    }

    return 0;
};

const getAuditSequenceNumber = (auditNumber: string) => {
    const match = String(auditNumber || '').match(/^AUD-\d{4}-(\d+)$/);

    if (!match) return 0;

    return Number(match[1]) || 0;
};

const sortAuditNewestFirst = (logs: AuditLog[]) => {
    return [...logs].sort((a, b) => {
        const timeDifference =
            getAuditLogTimestamp(b.date_time) -
            getAuditLogTimestamp(a.date_time);

        if (timeDifference !== 0) {
            return timeDifference;
        }

        return (
            getAuditSequenceNumber(b.audit_number) -
            getAuditSequenceNumber(a.audit_number)
        );
    });
};

const truncateValue = (value: string, maxLength = 80) => {
    if (!value) return '-';

    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength)}...`;
};

const formatActionLabel = (value: string) => {
    if (!value) return '-';

    return value
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(' ');
};

const getActionBadgeClassName = (action: string) => {
    const normalizedAction = action.toLowerCase();

    if (
        normalizedAction.includes('delete') ||
        normalizedAction.includes('remove') ||
        normalizedAction.includes('hapus')
    ) {
        return 'bg-red-50 text-red-600';
    }

    if (
        normalizedAction.includes('add') ||
        normalizedAction.includes('create') ||
        normalizedAction.includes('register') ||
        normalizedAction.includes('tambah') ||
        normalizedAction.includes('buat')
    ) {
        return 'bg-[#D2E3C8] text-[#4F6F52]';
    }

    if (
        normalizedAction.includes('update') ||
        normalizedAction.includes('change') ||
        normalizedAction.includes('edit') ||
        normalizedAction.includes('ubah') ||
        normalizedAction.includes('perbarui')
    ) {
        return 'bg-[#EAF1E4] text-[#5F785F]';
    }

    if (normalizedAction.includes('login')) {
        return 'bg-[#F3E8C8] text-[#7A5A00]';
    }

    return 'bg-[#F2F2F2] text-[#5F5F5F]';
};

const getCalendarDays = (calendarMonth: Date): CalendarDay[] => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

    const days: CalendarDay[] = [];

    for (let index = 0; index < 42; index += 1) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);

        days.push({
            dateString: toInputDateValue(date),
            dayNumber: date.getDate(),
            isCurrentMonth: date.getMonth() === month,
        });
    }

    return days;
};

const getUniqueOptions = (values: Array<string | null | undefined>) => {
    return Array.from(
        new Set(
            values
                .map((value) => String(value || '').trim())
                .filter(Boolean),
        ),
    ).sort((a, b) => a.localeCompare(b));
};

const ForbiddenView = () => {
    return (
        <div className="flex min-h-[calc(100dvh-48px)] w-full items-center justify-center px-4">
            <div className="w-full max-w-[460px] rounded-[24px] border border-red-200 bg-white px-6 py-8 text-center shadow-sm">
                <div className="mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-full bg-red-50 text-[24px] font-extrabold text-red-600">
                    403
                </div>

                <h1 className="mt-5 text-[24px] font-extrabold text-[#2F3A2F]">
                    Forbidden Access
                </h1>

                <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#6B6B6B]">
                    Kamu tidak memiliki izin untuk mengakses halaman Activity
                    History.
                </p>

                <p className="mt-2 text-[12px] font-semibold text-red-600">
                    Halaman ini hanya dapat diakses oleh admin dan bidan.
                </p>
            </div>
        </div>
    );
};

const ActivityHistory = () => {
    const router = useRouter();
    const today = getTodayInputValue();
    const calendarRef = useRef<HTMLDivElement | null>(null);

    const [selectedDate, setSelectedDate] = useState('');
    const [calendarMonth, setCalendarMonth] = useState(
        new Date(`${today}T00:00:00`),
    );
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [actionOptions, setActionOptions] = useState<string[]>([]);

    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [isForbidden, setIsForbidden] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const formattedSelectedDate = useMemo(() => {
        return formatDisplayDate(selectedDate);
    }, [selectedDate]);

    const calendarDays = useMemo(() => {
        return getCalendarDays(calendarMonth);
    }, [calendarMonth]);

    const showLoadingOverlay = isCheckingAccess || isLoading;

    const clearSession = () => {
        Cookies.remove('access_token', { path: '/' });

        localStorage.removeItem('user_id');
        localStorage.removeItem('temp_user_id');
        localStorage.removeItem('fullname');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('clinic_id');
        localStorage.removeItem('profile_photo');
        localStorage.removeItem('requires_clinic_setup');
    };

    const handleUnauthorized = () => {
        clearSession();
        router.push('/login');
    };

    const handleForbidden = () => {
        setHasAccess(false);
        setIsForbidden(true);
    };

    const checkActivityAccess = async () => {
        try {
            setIsCheckingAccess(true);
            setIsForbidden(false);
            setHasAccess(false);
            setErrorMessage('');

            const token = Cookies.get('access_token');

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.get(`/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = response.data as MeResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            if (response.status !== 200 || !data.user) {
                throw new Error(data?.msg || 'Gagal memeriksa akses user.');
            }

            const role = normalizeRole(data.user.role || data.user.user_role);

            if (!canAccessActivityHistory(role)) {
                handleForbidden();
                return;
            }

            if (
                role === 'midwife' &&
                data.requires_clinic_setup &&
                data.redirect_path
            ) {
                router.push(data.redirect_path || '/register-clinic');
                return;
            }

            localStorage.setItem('user_id', data.user.id || '');
            localStorage.setItem('temp_user_id', data.user.id || '');
            localStorage.setItem('fullname', data.user.fullname || '');
            localStorage.setItem('user_email', data.user.email || '');
            localStorage.setItem('user_role', role || '');
            localStorage.setItem('clinic_id', data.user.clinic_id || '');
            localStorage.setItem(
                'requires_clinic_setup',
                data.requires_clinic_setup ? 'true' : 'false',
            );

            setHasAccess(true);
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Tidak dapat memeriksa akses user.';

            setErrorMessage(message);
            handleForbidden();
        } finally {
            setIsCheckingAccess(false);
        }
    };

    const fetchActionOptions = async () => {
        try {
            const token = Cookies.get('access_token');

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.get(`/activity-history/actions`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = response.data;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 400 && data?.requires_clinic_setup) {
                router.push(data.redirect_path || '/register-clinic');
                return;
            }

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            if (response.status === 200 && Array.isArray(data)) {
                setActionOptions(data);
            }
        } catch {
            setActionOptions([]);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');

            const token = Cookies.get('access_token');

            if (!token) {
                handleUnauthorized();
                return;
            }

            const params = new URLSearchParams();

            if (selectedDate) {
                params.set('date', selectedDate);
            }

            if (searchQuery.trim()) {
                params.set('search', searchQuery.trim());
            }

            if (actionFilter !== 'all') {
                params.set('action', actionFilter);
            }

            const queryString = params.toString();

            const response = await api.get(`/activity-history/get-all${queryString ? `?${queryString}` : ''}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            },
            );

            const data = response.data;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 400 && data?.requires_clinic_setup) {
                router.push(data.redirect_path || '/register-clinic');
                return;
            }

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            if (response.status !== 200) {
                throw new Error(data?.msg || 'Gagal mengambil Activity History.');
            }

            setAuditLogs(sortAuditNewestFirst(Array.isArray(data) ? data : []));
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Terjadi kesalahan saat mengambil Activity History.';

            setErrorMessage(message);
            setAuditLogs([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkActivityAccess();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!hasAccess) return;

        fetchActionOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess]);

    useEffect(() => {
        if (!hasAccess) return;

        fetchAuditLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess, selectedDate, actionFilter]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                calendarRef.current &&
                !calendarRef.current.contains(event.target as Node)
            ) {
                setIsCalendarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fallbackActionOptions = useMemo(() => {
        if (actionOptions.length > 0) return actionOptions;

        return getUniqueOptions(auditLogs.map((log) => log.action));
    }, [actionOptions, auditLogs]);

    const filteredAuditLogs = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();

        const filteredLogs = auditLogs.filter((log) => {
            const logDate = normalizeDateFromDateTime(log.date_time);
            const matchesDate = selectedDate ? logDate === selectedDate : true;

            const searchableText = [
                log.audit_number,
                log.date_time,
                log.user,
                log.user_email,
                log.action,
                log.module,
                log.record_id,
                log.old_value,
                log.new_value,
            ]
                .join(' ')
                .toLowerCase();

            const matchesSearch =
                !normalizedSearch ||
                searchableText.includes(normalizedSearch);

            const matchesAction =
                actionFilter === 'all' || log.action === actionFilter;

            return matchesDate && matchesSearch && matchesAction;
        });

        return sortAuditNewestFirst(filteredLogs);
    }, [auditLogs, selectedDate, searchQuery, actionFilter]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredAuditLogs.length / itemsPerPage),
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;

    const currentAuditLogs = filteredAuditLogs.slice(
        indexOfFirstItem,
        indexOfLastItem,
    );

    const showingStart =
        filteredAuditLogs.length === 0 ? 0 : indexOfFirstItem + 1;
    const showingEnd = Math.min(indexOfLastItem, filteredAuditLogs.length);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedDate, searchQuery, actionFilter, auditLogs]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const activeFilterCount = useMemo(() => {
        return actionFilter !== 'all' ? 1 : 0;
    }, [actionFilter]);

    const getPageNumbers = () => {
        const pageNumbers: Array<number | string> = [];

        if (totalPages <= 4) {
            for (let page = 1; page <= totalPages; page += 1) {
                pageNumbers.push(page);
            }
        } else if (currentPage <= 2) {
            pageNumbers.push(1);
            pageNumbers.push(2);

            if (currentPage === 2) pageNumbers.push(3);

            pageNumbers.push('...');
            pageNumbers.push(totalPages);
        } else if (currentPage === 3) {
            pageNumbers.push(1);
            pageNumbers.push(2);
            pageNumbers.push(3);
            pageNumbers.push(4);
            pageNumbers.push('...');
            pageNumbers.push(totalPages);
        } else if (currentPage >= totalPages - 1) {
            pageNumbers.push(1);
            pageNumbers.push('...');

            if (currentPage === totalPages - 1) {
                pageNumbers.push(totalPages - 2);
            }

            pageNumbers.push(totalPages - 1);
            pageNumbers.push(totalPages);
        } else {
            pageNumbers.push(1);
            pageNumbers.push('...');
            pageNumbers.push(currentPage - 1);
            pageNumbers.push(currentPage);
            pageNumbers.push(currentPage + 1);
            pageNumbers.push('...');
            pageNumbers.push(totalPages);
        }

        return pageNumbers;
    };

    const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        fetchAuditLogs();
    };

    const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
    };

    const handleSelectDate = (dateString: string) => {
        setSelectedDate(dateString);
        setCalendarMonth(new Date(`${dateString}T00:00:00`));
        setIsCalendarOpen(false);
    };

    const handlePreviousMonth = () => {
        setCalendarMonth((currentMonth) => {
            const nextMonth = new Date(currentMonth);
            nextMonth.setMonth(currentMonth.getMonth() - 1);

            return nextMonth;
        });
    };

    const handleNextMonth = () => {
        setCalendarMonth((currentMonth) => {
            const nextMonth = new Date(currentMonth);
            nextMonth.setMonth(currentMonth.getMonth() + 1);

            return nextMonth;
        });
    };

    const handleReset = () => {
        setSelectedDate('');
        setCalendarMonth(new Date(`${today}T00:00:00`));
        setSearchQuery('');
        setActionFilter('all');
        setIsFilterOpen(false);
        setIsCalendarOpen(false);
        setCurrentPage(1);
    };

    const handleShowAllDates = () => {
        setSelectedDate('');
        setIsCalendarOpen(false);
    };

    const handleClearFilter = () => {
        setActionFilter('all');
    };

    const handleTodayDate = () => {
        setSelectedDate(today);
        setCalendarMonth(new Date(`${today}T00:00:00`));
        setIsCalendarOpen(false);
    };

    const goToDetail = (auditId: string) => {
        if (!auditId) return;

        router.push(`/activity-history/${auditId}`);
    };

    const renderTableValue = (log: AuditLog, key: TableKey) => {
        if (key === 'date_time') {
            return formatDateTime(log.date_time);
        }

        if (key === 'action') {
            return (
                <span
                    className={`inline-flex max-w-[160px] justify-center rounded-full px-3 py-1 text-[10px] font-bold ${getActionBadgeClassName(
                        log.action,
                    )}`}
                    title={log.action || '-'}
                >
                    <span className="truncate">
                        {formatActionLabel(log.action)}
                    </span>
                </span>
            );
        }

        if (key === 'old_value' || key === 'new_value') {
            return truncateValue(log[key], 80);
        }

        return log[key] || '-';
    };

    if (isCheckingAccess) {
        return (
            <div className="relative flex min-h-[calc(100dvh-48px)] w-full items-center justify-center">
                <LoadingOverlay />
            </div>
        );
    }

    if (isForbidden) {
        return <ForbiddenView />;
    }

    if (!hasAccess) {
        return null;
    }

    return (
        <div className="flex-1 flex flex-col w-full gap-5">
            {showLoadingOverlay && <LoadingOverlay />}

            <section className="w-full rounded-[22px] border border-[#D2D8CF] bg-white px-5 py-5 shadow-sm sm:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <form
                        onSubmit={handleSearchSubmit}
                        className="relative min-w-0 flex-1 rounded-[50px] border border-[#D2D8CF] bg-[#FDFEF9] px-5 py-[10px] md:py-[12px] shadow-sm transition-all focus-within:border-[#739072] xl:max-w-[680px]"
                    >
                        <Search className="absolute left-5 top-1/2 w-3.5 md:w-4 -translate-y-1/2 text-gray-400" />

                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder="Cari ID audit, pengguna, aksi, modul, atau record ID..."
                            className="w-full bg-transparent pl-8 text-[10px] md:text-[13px] text-gray-700 outline-none placeholder-gray-400"
                        />
                    </form>

                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 sm:items-center sm:justify-between">
                        <div className="flex justify-center items-center rounded-[50px] bg-[#D2E3C8] py-1 md:py-2 px-8  text-center text-[9px] md:text-[12px] font-bold text-black shadow-sm">
                            {formattedSelectedDate}
                        </div>

                        <div ref={calendarRef} className="relative inline-block">
                            <button
                                type="button"
                                onClick={() =>
                                    setIsCalendarOpen((current) => !current)
                                }
                                className="rounded-[50px] border border-[#BFC7BB] bg-white py-1 md:py-2 w-full  text-[9px] md:text-[12px] font-bold text-[#4B4B4B] shadow-sm transition-all hover:border-[#739072] hover:bg-[#F9FBF7]"
                            >
                                <span>Filter Tanggal</span>

                                <CalendarDays className="ml-[10px] inline-block w-3 md:w-4 text-black" />
                            </button>

                            {isCalendarOpen && (
                                <div className="absolute left-1/2 top-[calc(100%+12px)] z-[70] w-[320px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-b-[18px] bg-white shadow-[0_16px_32px_rgba(0,0,0,0.14)]">
                                    <div className="absolute left-1/2 top-[-12px] h-0 w-0 -translate-x-1/2 border-x-[11px] border-b-[12px] border-x-transparent border-b-[#D2E3C8]" />

                                    <div className="flex items-center justify-between rounded-t-[18px] bg-[#D2E3C8] px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={handlePreviousMonth}
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4F6F52] transition-all hover:bg-white/40"
                                            aria-label="Bulan sebelumnya"
                                        >
                                            <ChevronLeft className="w-5" />
                                        </button>

                                        <p className="text-[18px] font-extrabold text-black">
                                            {
                                                monthNames[
                                                calendarMonth.getMonth()
                                                ]
                                            }{' '}
                                            {calendarMonth.getFullYear()}
                                        </p>

                                        <button
                                            type="button"
                                            onClick={handleNextMonth}
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4F6F52] transition-all hover:bg-white/40"
                                            aria-label="Bulan berikutnya"
                                        >
                                            <ChevronRight className="w-5" />
                                        </button>
                                    </div>

                                    <div className="px-4 pb-4 pt-4">
                                        <div className="grid grid-cols-7 text-center">
                                            {dayLabels.map((dayLabel) => (
                                                <div
                                                    key={dayLabel}
                                                    className="pb-2 text-[14px] font-extrabold text-[#5F785F]"
                                                >
                                                    {dayLabel}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-7 gap-y-2 text-center">
                                            {calendarDays.map((day) => {
                                                const isSelected =
                                                    day.dateString ===
                                                    selectedDate;
                                                const isToday =
                                                    day.dateString === today;

                                                return (
                                                    <button
                                                        key={day.dateString}
                                                        type="button"
                                                        onClick={() =>
                                                            handleSelectDate(
                                                                day.dateString,
                                                            )
                                                        }
                                                        className={`mx-auto flex h-[34px] w-[34px] items-center justify-center rounded-[8px] text-[15px] font-medium transition-all ${isSelected
                                                                ? 'border border-[#739072] bg-white text-[#739072]'
                                                                : isToday
                                                                    ? 'bg-[#EEF3E9] text-[#4F6F52]'
                                                                    : day.isCurrentMonth
                                                                        ? 'text-black hover:bg-[#EEF3E9]'
                                                                        : 'text-black/70 hover:bg-[#EEF3E9]'
                                                            }`}
                                                    >
                                                        {day.dayNumber}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-[#E4E8E1] pt-3">
                                            <button
                                                type="button"
                                                onClick={handleTodayDate}
                                                className="rounded-[30px] border border-[#BFC7BB] bg-white px-3 py-2 text-[11px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4]"
                                            >
                                                Hari Ini
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleShowAllDates}
                                                className="rounded-[30px] border border-[#BFC7BB] bg-white px-3 py-2 text-[11px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4]"
                                            >
                                                Semua
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setIsCalendarOpen(false)
                                                }
                                                className="rounded-[30px] bg-[#86A789] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#739072]"
                                            >
                                                Selesai
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setIsFilterOpen((current) => !current)
                            }
                            className={`rounded-[50px] border px-[18px] py-[11px] text-[12px] font-bold shadow-sm transition-all ${isFilterOpen || activeFilterCount > 0
                                    ? 'border-[#739072] bg-[#EEF3E9] text-[#4F6F52]'
                                    : 'border-[#BFC7BB] bg-white text-[#4B4B4B] hover:border-[#739072] hover:bg-[#F9FBF7]'
                                }`}
                        >
                            <span>
                                Filter
                                {activeFilterCount > 0
                                    ? ` (${activeFilterCount})`
                                    : ''}
                            </span>

                            <Filter className="ml-[10px] inline-block w-4 text-black" />
                        </button>

                        <button
                            type="button"
                            onClick={handleReset}
                            className="rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] py-[11px] text-[12px] font-bold text-[#4B4B4B] shadow-sm transition-all hover:bg-[#F4F4F4]"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {isFilterOpen && (
                    <div className="mt-[18px] rounded-[16px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-[18px]">
                        <div className="grid w-full min-w-0 grid-cols-1 gap-[14px] md:grid-cols-[1fr_auto_auto] md:items-end">
                            <label className="block min-w-0">
                                <span className="text-[11px] font-bold text-black">
                                    Action
                                </span>

                                <select
                                    value={actionFilter}
                                    onChange={(event) =>
                                        setActionFilter(event.target.value)
                                    }
                                    className="mt-[8px] h-[36px] w-full min-w-0 rounded-[8px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                >
                                    <option value="all">Semua Aksi</option>

                                    {fallbackActionOptions.map((action) => (
                                        <option key={action} value={action}>
                                            {formatActionLabel(action)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <button
                                type="button"
                                onClick={handleShowAllDates}
                                className="h-[36px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-[#4B4B4B] transition-all hover:bg-[#F4F4F4]"
                            >
                                Semua Tanggal
                            </button>

                            <button
                                type="button"
                                onClick={handleClearFilter}
                                className="h-[36px] rounded-[50px] bg-[#86A789] px-[18px] text-[12px] font-bold text-white transition-all hover:bg-[#739072]"
                            >
                                Hapus Filter
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {errorMessage && (
                <div className="w-full rounded-[10px] border border-red-200 bg-red-50 px-[16px] py-[12px] text-[12px] font-medium text-red-700">
                    {errorMessage}
                </div>
            )}

            <section className="min-h-[600px] w-full overflow-hidden rounded-[22px] border border-[#D2D8CF] bg-white shadow-sm">
                <div className="border-b border-[#E4E8E1] px-5 py-[20px] sm:px-[26px]">
                    <div className="min-w-0">
                        <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                            Audit Log
                        </h2>
                    </div>

                </div>

                <div className="block lg:hidden">
                    <div className="grid grid-cols-1 gap-[12px] px-4 py-4 sm:grid-cols-2">
                        {isLoading ? (
                            <div className="col-span-full rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[12px] text-gray-500">
                                Memuat riwayat aktivitas...
                            </div>
                        ) : currentAuditLogs.length === 0 ? (
                            <div className="col-span-full rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[12px] text-gray-500">
                                Tidak ada riwayat aktivitas untuk{' '}
                                {formattedSelectedDate}
                            </div>
                        ) : (
                            currentAuditLogs.map((log) => (
                                <button
                                    key={log.audit_id || log.audit_number}
                                    type="button"
                                    onClick={() => goToDetail(log.audit_id)}
                                    className="w-full rounded-[16px] border border-[#E4E8E1] bg-white px-4 py-4 text-left shadow-sm transition-all hover:border-[#86A789] hover:bg-[#F8FAF6]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-[13px] font-bold text-black">
                                                {log.audit_number || '-'}
                                            </p>

                                            <p className="mt-[5px] text-[11px] font-medium text-[#6B6B6B]">
                                                {formatDateTime(log.date_time)}
                                            </p>
                                        </div>

                                        <span
                                            className={`inline-flex max-w-[130px] shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${getActionBadgeClassName(
                                                log.action,
                                            )}`}
                                            title={log.action || '-'}
                                        >
                                            <span className="truncate">
                                                {formatActionLabel(log.action)}
                                            </span>
                                        </span>
                                    </div>

                                    <div className="mt-[14px] grid grid-cols-2 gap-x-4 gap-y-3">
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                User
                                            </p>

                                            <p className="mt-[4px] truncate text-[11px] font-semibold text-black">
                                                {log.user || '-'}
                                            </p>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Module
                                            </p>

                                            <p className="mt-[4px] truncate text-[11px] font-semibold text-black">
                                                {log.module || '-'}
                                            </p>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Record ID
                                            </p>

                                            <p className="mt-[4px] truncate text-[11px] font-semibold text-black">
                                                {log.record_id || '-'}
                                            </p>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Email
                                            </p>

                                            <p className="mt-[4px] truncate text-[11px] font-semibold text-black">
                                                {log.user_email || '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-[14px] grid grid-cols-1 gap-3">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Data Lama
                                            </p>

                                            <p
                                                className="mt-[4px] break-words rounded-[10px] bg-[#F8FAF6] px-3 py-2 text-[11px] leading-relaxed text-[#4B4B4B]"
                                                title={log.old_value || '-'}
                                            >
                                                {truncateValue(
                                                    log.old_value,
                                                    120,
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Data Baru
                                            </p>

                                            <p
                                                className="mt-[4px] break-words rounded-[10px] bg-[#F8FAF6] px-3 py-2 text-[11px] leading-relaxed text-[#4B4B4B]"
                                                title={log.new_value || '-'}
                                            >
                                                {truncateValue(
                                                    log.new_value,
                                                    120,
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="hidden w-full overflow-x-auto lg:block">
                    <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-[12px]">
                        <thead className="bg-[#FDFEF9] text-[10px] font-bold uppercase text-[#5F785F]">
                            <tr className="bg-[#D2E3C8] text-gray-700">
                                {tableHeaders.map((header, index) => (
                                    <th
                                        key={header.key}
                                        className={`px-6 py-4 text-center font-bold ${index !== tableHeaders.length - 1
                                                ? 'border-r border-gray-200'
                                                : ''
                                            }`}
                                    >
                                        {header.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td
                                        colSpan={tableHeaders.length}
                                        className="px-6 py-20 text-center text-gray-400"
                                    >
                                        Memuat riwayat aktivitas...
                                    </td>
                                </tr>
                            ) : currentAuditLogs.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={tableHeaders.length}
                                        className="px-6 py-20 text-center text-gray-400"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <p className="text-sm">
                                                Tidak ada riwayat aktivitas untuk{' '}
                                                {formattedSelectedDate}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                currentAuditLogs.map((log, rowIndex) => (
                                    <tr
                                        key={log.audit_id || log.audit_number}
                                        onClick={() => goToDetail(log.audit_id)}
                                        className={`cursor-pointer text-center text-black transition-all hover:bg-[#EEF3E9] ${rowIndex % 2 === 0
                                                ? 'bg-white'
                                                : 'bg-[#FBFCF8]'
                                            }`}
                                    >
                                        {tableHeaders.map((header) => (
                                            <td
                                                key={header.key}
                                                className="px-4 py-4"
                                                title={
                                                    typeof log[header.key] ===
                                                        'string'
                                                        ? log[header.key]
                                                        : ''
                                                }
                                            >
                                                <div className="mx-auto max-w-[180px] truncate">
                                                    {renderTableValue(
                                                        log,
                                                        header.key,
                                                    )}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="flex items-center justify-between border-t px-4 py-4 sm:px-6">
                <div className="hidden sm:block">
                    <p className="text-[11px] text-gray-500">
                        Menampilkan{' '}
                        <span className="font-semibold text-black">
                            {showingStart}
                        </span>{' '}
                        sampai{' '}
                        <span className="font-semibold text-black">
                            {showingEnd}
                        </span>{' '}
                        dari{' '}
                        <span className="font-semibold text-black">
                            {filteredAuditLogs.length}
                        </span>{' '}
                        data
                    </p>
                </div>

                <div className="flex items-center gap-x-1.5">
                    <button
                        type="button"
                        onClick={() =>
                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={currentPage === 1}
                        className="flex items-center gap-x-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-[12px] font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Sebelumnya</span>
                    </button>

                    {getPageNumbers().map((page, index) => {
                        if (page === '...') {
                            return (
                                <span
                                    key={`ellipsis-${index}`}
                                    className="flex h-8 w-8 items-center justify-center text-[12px] text-gray-400"
                                >
                                    ...
                                </span>
                            );
                        }

                        return (
                            <button
                                key={`page-${page}`}
                                type="button"
                                onClick={() => setCurrentPage(Number(page))}
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all ${currentPage === page
                                        ? 'scale-105 bg-[#739072] text-white shadow-md'
                                        : 'bg-transparent text-gray-600 hover:bg-[#EEF3E9] hover:text-[#4F6F52]'
                                    }`}
                            >
                                {page}
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() =>
                            setCurrentPage((prev) =>
                                Math.min(prev + 1, totalPages),
                            )
                        }
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-x-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-[12px] font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span>Berikutnya</span>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActivityHistory;