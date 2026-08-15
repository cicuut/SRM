'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    FileDown,
    Filter,
    Plus,
    Search,
} from 'lucide-react';
import LoadingOverlay from '@/components/loading';
import api from '@/utils/app';

type Role = 'admin' | 'midwife' | 'asisten' | '';

const FINANCIAL_ALLOWED_ROLES: Role[] = ['midwife'];

type FinancialTransaction = {
    transaction_id: string;
    visit_id?: string | null;
    user_id?: string | null;
    patient_id?: string | null;
    transaction_number: string;
    trans_id?: string | null;
    payment_date: string;
    trans_type: string;
    amount: number;
    payment_method: string;
    status: string;
    visit_status?: string | null;
    description?: string;
    visit_display?: string;
    visit_number?: string;
    record_number?: string;
    record_type?: string;
    patient_name?: string;
    user_name?: string;
};

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
    };
    clinic?: {
        id: string;
        clinic_name: string;
    } | null;
};

type TableKey =
    | 'transaction_number'
    | 'payment_date'
    | 'trans_type'
    | 'visit_display'
    | 'payment_method'
    | 'amount'
    | 'status';

type TableHeader = {
    label: string;
    key: TableKey;
};

type CalendarDay = {
    dateString: string;
    dayNumber: number;
    isCurrentMonth: boolean;
};

type FilterOptions = {
    types: string[];
    methods: string[];
    statuses: string[];
};

const tableHeaders: TableHeader[] = [
    {
        label: 'Nomor Invoice',
        key: 'transaction_number',
    },
    {
        label: 'Tanggal',
        key: 'payment_date',
    },
    {
        label: 'Tipe',
        key: 'trans_type',
    },
    {
        label: 'Visit / Rekam Medis',
        key: 'visit_display',
    },
    {
        label: 'Metode',
        key: 'payment_method',
    },
    {
        label: 'Nominal',
        key: 'amount',
    },
    {
        label: 'Status',
        key: 'status',
    },
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

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const safeLower = (value: unknown) => {
    return String(value ?? '').toLowerCase();
};

const isPendingVisitTransaction = (transaction: FinancialTransaction) => {
    return safeLower(transaction.visit_status).trim() === 'pending';
};

const normalizeDateInput = (dateString?: string | null) => {
    if (!dateString) return '';

    return dateString.includes('T') ? dateString.split('T')[0] : dateString;
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

const formatShortDate = (dateString?: string | null) => {
    if (!dateString) return '-';

    const normalizedDate = normalizeDateInput(dateString);
    const date = new Date(`${normalizedDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return normalizedDate;
    }

    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const formatDateRangeDisplay = (startDate: string, endDate: string) => {
    if (!startDate && !endDate) {
        return 'Semua Tanggal';
    }

    if (startDate && !endDate) {
        return formatDisplayDate(startDate);
    }

    if (startDate && endDate && startDate === endDate) {
        return formatDisplayDate(startDate);
    }

    return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
};

const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number(value || 0));
};

const formatEnumLabel = (value: string) => {
    if (!value) return '-';

    const normalizedValue = value.replace(/_/g, ' ');
    const lowerValue = normalizedValue.toLowerCase();

    if (lowerValue === 'qris') return 'QRIS';
    if (lowerValue === 'pemasukan') return 'Pemasukan';
    if (lowerValue === 'pengeluaran') return 'Pengeluaran';
    if (lowerValue === 'paid') return 'Dibayar';
    if (lowerValue === 'unpaid') return 'Belum Dibayar';

    return normalizedValue
        .split(' ')
        .filter(Boolean)
        .map(
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(' ');
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

const getStatusBadgeClassName = (status: string) => {
    const normalizedStatus = safeLower(status);

    if (normalizedStatus === 'paid') {
        return 'bg-[#D2E3C8] text-[#4F6F52]';
    }

    if (normalizedStatus === 'unpaid') {
        return 'bg-red-50 text-red-600';
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

const isDateBetween = (date: string, startDate: string, endDate: string) => {
    if (!date || !startDate || !endDate) return false;

    return date >= startDate && date <= endDate;
};

const getTransactionTimestamp = (paymentDate?: string | null) => {
    const normalizedDate = normalizeDateInput(paymentDate);

    if (!normalizedDate) return 0;

    const timestamp = new Date(`${normalizedDate}T00:00:00`).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getTransactionSequenceNumber = (transactionNumber?: string | null) => {
    const match = String(transactionNumber || '').match(/^INV-\d{4}-(\d+)$/);

    if (!match) return 0;

    return Number(match[1]) || 0;
};

const sortFinancialNewestFirst = (items: FinancialTransaction[]) => {
    return [...items].sort((a, b) => {
        const dateDifference =
            getTransactionTimestamp(b.payment_date) -
            getTransactionTimestamp(a.payment_date);

        if (dateDifference !== 0) {
            return dateDifference;
        }

        return (
            getTransactionSequenceNumber(b.transaction_number) -
            getTransactionSequenceNumber(a.transaction_number)
        );
    });
};

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

const translateMessage = (message?: string) => {
    const rawMessage = String(message || '').trim();

    if (!rawMessage) {
        return 'Terjadi kesalahan. Silakan coba lagi.';
    }

    const normalizedMessage = rawMessage.toLowerCase();

    if (
        normalizedMessage.includes('failed to fetch') ||
        normalizedMessage.includes('network error')
    ) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    if (
        normalizedMessage.includes('only admin') ||
        normalizedMessage.includes('only midwife') ||
        normalizedMessage.includes('forbidden') ||
        normalizedMessage.includes('permission')
    ) {
        return 'Anda tidak memiliki izin untuk mengakses halaman laporan keuangan.';
    }

    if (normalizedMessage.includes('inactive')) {
        return 'Akun Anda sedang tidak aktif.';
    }

    if (normalizedMessage.includes('akun anda sedang tidak aktif')) {
        return 'Akun Anda sedang tidak aktif.';
    }

    return rawMessage;
};

const getVisitDisplayText = (transaction: FinancialTransaction) => {
    return (
        transaction.visit_display ||
        transaction.visit_number ||
        transaction.record_number ||
        '-'
    );
};

const getDownloadFileName = (startDate: string, endDate: string) => {
    const datePart =
        startDate && endDate
            ? `${startDate}_sd_${endDate}`
            : startDate
                ? startDate
                : 'semua-tanggal';

    return `laporan-keuangan-${datePart}.xlsx`;
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
                    Kamu tidak memiliki izin untuk mengakses halaman Laporan
                    Keuangan.
                </p>

                <p className="mt-2 text-[12px] font-semibold text-red-600">
                    Halaman ini hanya dapat diakses oleh admin dan bidan.
                </p>
            </div>
        </div>
    );
};

const FinancialReport = () => {
    const router = useRouter();
    const today = getTodayInputValue();
    const calendarRef = useRef<HTMLDivElement | null>(null);

    const [selectedStartDate, setSelectedStartDate] = useState('');
    const [selectedEndDate, setSelectedEndDate] = useState('');

    const [calendarMonth, setCalendarMonth] = useState(
        new Date(`${today}T00:00:00`),
    );
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');

    const [typeFilter, setTypeFilter] = useState('all');
    const [methodFilter, setMethodFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [transactions, setTransactions] = useState<FinancialTransaction[]>(
        [],
    );

    const [hasAccess, setHasAccess] = useState(false);
    const [isForbidden, setIsForbidden] = useState(false);
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const formattedSelectedDateRange = useMemo(() => {
        return formatDateRangeDisplay(selectedStartDate, selectedEndDate);
    }, [selectedStartDate, selectedEndDate]);

    const calendarDays = useMemo(() => {
        return getCalendarDays(calendarMonth);
    }, [calendarMonth]);

    const showLoadingOverlay = isCheckingAccess || isLoading || isDownloading;

    const getToken = () => {
        return Cookies.get('access_token');
    };

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

    const checkFinancialAccess = async () => {
        try {
            setIsCheckingAccess(true);
            setIsForbidden(false);
            setErrorMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.get('/auth/me', {
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
                throw new Error(data?.msg || 'Gagal mengecek akses user.');
            }

            const role = normalizeRole(data.user.role || data.user.user_role);

            if (!FINANCIAL_ALLOWED_ROLES.includes(role)) {
                handleForbidden();
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
                    : 'Terjadi kesalahan saat mengecek akses.';

            setErrorMessage(message);
        } finally {
            setIsCheckingAccess(false);
        }
    };

    const fetchFinancialTransactions = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.get('/financial/get-all', {
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

            if (response.status !== 200) {
                throw new Error(data?.msg || 'Gagal mengambil data keuangan.');
            }

            const rawTransactions: FinancialTransaction[] = Array.isArray(data)
                ? data
                : data?.data || [];

            const approvedTransactions = rawTransactions.filter(
                (transaction) => !isPendingVisitTransaction(transaction),
            );

            setTransactions(sortFinancialNewestFirst(approvedTransactions));
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Terjadi kesalahan saat mengambil data keuangan.';

            setErrorMessage(message);
            setTransactions([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkFinancialAccess();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!hasAccess) return;

        fetchFinancialTransactions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess]);

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

    const filterOptions = useMemo<FilterOptions>(() => {
        return {
            types: getUniqueOptions(
                transactions.map((transaction) => transaction.trans_type),
            ),
            methods: getUniqueOptions(
                transactions.map((transaction) => transaction.payment_method),
            ),
            statuses: getUniqueOptions(
                transactions.map((transaction) => transaction.status),
            ),
        };
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();

        const filteredItems = transactions.filter((transaction) => {
            const transactionDate = normalizeDateInput(
                transaction.payment_date,
            );

            let matchesDateRange = true;

            if (selectedStartDate && selectedEndDate) {
                matchesDateRange = isDateBetween(
                    transactionDate,
                    selectedStartDate,
                    selectedEndDate,
                );
            } else if (selectedStartDate && !selectedEndDate) {
                matchesDateRange = transactionDate === selectedStartDate;
            }

            const searchableText = [
                transaction.transaction_number,
                transaction.trans_id,
                transaction.payment_date,
                transaction.trans_type,
                transaction.visit_display,
                transaction.visit_number,
                transaction.record_number,
                transaction.record_type,
                transaction.payment_method,
                transaction.status,
                transaction.patient_name,
                transaction.user_name,
                transaction.description,
                String(transaction.amount),
                formatRupiah(transaction.amount),
            ]
                .join(' ')
                .toLowerCase();

            const matchesSearch =
                !normalizedSearch ||
                searchableText.includes(normalizedSearch);

            const matchesType =
                typeFilter === 'all' ||
                safeLower(transaction.trans_type) === safeLower(typeFilter);

            const matchesMethod =
                methodFilter === 'all' ||
                safeLower(transaction.payment_method) ===
                safeLower(methodFilter);

            const matchesStatus =
                statusFilter === 'all' ||
                safeLower(transaction.status) === safeLower(statusFilter);

            return (
                matchesDateRange &&
                matchesSearch &&
                matchesType &&
                matchesMethod &&
                matchesStatus
            );
        });

        return sortFinancialNewestFirst(filteredItems);
    }, [
        transactions,
        selectedStartDate,
        selectedEndDate,
        searchQuery,
        typeFilter,
        methodFilter,
        statusFilter,
    ]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredTransactions.length / itemsPerPage),
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;

    const currentTransactions = filteredTransactions.slice(
        indexOfFirstItem,
        indexOfLastItem,
    );

    const showingStart =
        filteredTransactions.length === 0 ? 0 : indexOfFirstItem + 1;
    const showingEnd = Math.min(indexOfLastItem, filteredTransactions.length);

    useEffect(() => {
        setCurrentPage(1);
    }, [
        selectedStartDate,
        selectedEndDate,
        searchQuery,
        typeFilter,
        methodFilter,
        statusFilter,
        transactions,
    ]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const activeFilterCount = useMemo(() => {
        return [typeFilter, methodFilter, statusFilter].filter(
            (value) => value !== 'all',
        ).length;
    }, [typeFilter, methodFilter, statusFilter]);

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

    const handleSelectDate = (dateString: string) => {
        if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
            setSelectedStartDate(dateString);
            setSelectedEndDate('');
            setCalendarMonth(new Date(`${dateString}T00:00:00`));
            return;
        }

        if (dateString < selectedStartDate) {
            setSelectedEndDate(selectedStartDate);
            setSelectedStartDate(dateString);
            setCalendarMonth(new Date(`${dateString}T00:00:00`));
            setIsCalendarOpen(false);
            return;
        }

        setSelectedEndDate(dateString);
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

    const handleClearFilter = () => {
        setTypeFilter('all');
        setMethodFilter('all');
        setStatusFilter('all');
    };

    const handleResetAll = () => {
        setSelectedStartDate('');
        setSelectedEndDate('');
        setCalendarMonth(new Date(`${today}T00:00:00`));
        setSearchQuery('');
        setTypeFilter('all');
        setMethodFilter('all');
        setStatusFilter('all');
        setIsFilterOpen(false);
        setIsCalendarOpen(false);
        setCurrentPage(1);
    };

    const handleShowAllDates = () => {
        setSelectedStartDate('');
        setSelectedEndDate('');
        setIsCalendarOpen(false);
    };

    const handleTodayDate = () => {
        setSelectedStartDate(today);
        setSelectedEndDate(today);
        setCalendarMonth(new Date(`${today}T00:00:00`));
        setIsCalendarOpen(false);
    };

    const handleDownload = async () => {
        if (filteredTransactions.length === 0 || isDownloading) {
            return;
        }

        try {
            setIsDownloading(true);
            setErrorMessage('');

            const XLSX = await import('xlsx');

            const reportRows = filteredTransactions.map(
                (transaction, index) => ({
                    No: index + 1,
                    'Nomor Invoice': transaction.transaction_number || '-',
                    Tanggal: formatShortDate(transaction.payment_date),
                    'Tanggal Raw': normalizeDateInput(transaction.payment_date),
                    'Tipe Transaksi': formatEnumLabel(transaction.trans_type),
                    'Visit / Rekam Medis': getVisitDisplayText(transaction),
                    'Nomor Kunjungan': transaction.visit_number || '-',
                    'Nomor Rekam Medis': transaction.record_number || '-',
                    'Jenis Rekam Medis': transaction.record_type || '-',
                    'Nama Pasien': transaction.patient_name || '-',
                    'Metode Pembayaran': transaction.payment_method
                        ? formatEnumLabel(transaction.payment_method)
                        : '-',
                    Nominal: Number(transaction.amount || 0),
                    'Nominal Format': formatRupiah(transaction.amount),
                    Status: formatEnumLabel(transaction.status),
                    Deskripsi: transaction.description || '-',
                    'Dibuat Oleh': transaction.user_name || '-',
                }),
            );

            const summaryRows = [
                {
                    Informasi: 'Tanggal Terpilih',
                    Nilai: formattedSelectedDateRange,
                },
                {
                    Informasi: 'Total Data',
                    Nilai: filteredTransactions.length,
                },
                {
                    Informasi: 'Total Pemasukan',
                    Nilai: filteredTransactions
                        .filter((transaction) =>
                            isIncomeType(transaction.trans_type),
                        )
                        .reduce(
                            (total, transaction) =>
                                total + Number(transaction.amount || 0),
                            0,
                        ),
                },
                {
                    Informasi: 'Total Pengeluaran',
                    Nilai: filteredTransactions
                        .filter((transaction) =>
                            isExpenseType(transaction.trans_type),
                        )
                        .reduce(
                            (total, transaction) =>
                                total + Number(transaction.amount || 0),
                            0,
                        ),
                },
            ];

            const workbook = XLSX.utils.book_new();

            const reportSheet = XLSX.utils.json_to_sheet(reportRows);
            const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

            reportSheet['!cols'] = [
                { wch: 6 },
                { wch: 22 },
                { wch: 16 },
                { wch: 14 },
                { wch: 18 },
                { wch: 24 },
                { wch: 18 },
                { wch: 18 },
                { wch: 18 },
                { wch: 24 },
                { wch: 18 },
                { wch: 16 },
                { wch: 18 },
                { wch: 16 },
                { wch: 30 },
                { wch: 22 },
            ];

            summarySheet['!cols'] = [{ wch: 22 }, { wch: 28 }];

            XLSX.utils.book_append_sheet(
                workbook,
                reportSheet,
                'Laporan Keuangan',
            );
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');

            XLSX.writeFile(
                workbook,
                getDownloadFileName(selectedStartDate, selectedEndDate),
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Gagal mengunduh laporan keuangan.';

            setErrorMessage(
                message.includes('Cannot find module') ||
                    message.includes('xlsx')
                    ? 'Package xlsx belum terpasang. Jalankan npm install xlsx lalu coba lagi.'
                    : translateMessage(message),
            );
        } finally {
            setIsDownloading(false);
        }
    };

    const isIncomeType = (transType?: string | null) => {
        return String(transType || '').trim().toLowerCase() === 'pemasukan';
    };

    const isExpenseType = (transType?: string | null) => {
        return String(transType || '').trim().toLowerCase() === 'pengeluaran';
    };

    const renderTableValue = (
        transaction: FinancialTransaction,
        key: TableKey,
    ) => {
        if (key === 'amount') {
            return formatRupiah(transaction.amount);
        }

        if (key === 'payment_date') {
            return formatShortDate(transaction.payment_date);
        }

        if (key === 'trans_type' || key === 'payment_method') {
            return formatEnumLabel(String(transaction[key]));
        }

        if (key === 'visit_display') {
            return getVisitDisplayText(transaction);
        }

        if (key === 'status') {
            return (
                <span
                    className={`inline-flex min-w-[74px] justify-center rounded-full px-3 py-1 text-[10px] font-bold ${getStatusBadgeClassName(
                        transaction.status,
                    )}`}
                >
                    {formatEnumLabel(transaction.status)}
                </span>
            );
        }

        return transaction[key] || '-';
    };

    const goToDetail = (transactionId: string) => {
        router.push(`/financial-report/${transactionId}`);
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

    return (
        <div className="relative flex w-full min-w-0 flex-col gap-5">
            {showLoadingOverlay && <LoadingOverlay />}

            <section className="w-full rounded-[22px] border border-[#D2D8CF] bg-white px-5 py-5 shadow-sm sm:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative min-w-0 flex-1 rounded-[50px] border border-[#D2D8CF] bg-[#FDFEF9] px-5 py-[10px] md:py-[12px] shadow-sm transition-all focus-within:border-[#739072] xl:max-w-[680px]">
                        <Search className="absolute left-5 top-1/2 w-3.5 md:w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) =>
                                setSearchQuery(event.target.value)
                            }
                            placeholder="Cari nomor invoice, visit, rekam medis"
                            className="w-full bg-transparent pl-8 text-[10px] md:text-[13px] text-gray-700 outline-none placeholder-gray-400"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 sm:items-center sm:justify-between">
                        <div className="rounded-[50px] bg-[#D2E3C8] px-[20px] py-[11px] text-center text-[12px] font-bold text-black shadow-sm">
                            {formattedSelectedDateRange}
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
                                        <p className="mb-3 text-center text-[11px] font-semibold text-[#6B6B6B]">
                                            {selectedStartDate &&
                                                !selectedEndDate
                                                ? 'Pilih tanggal akhir'
                                                : 'Pilih tanggal mulai'}
                                        </p>

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
                                                const isStart =
                                                    day.dateString ===
                                                    selectedStartDate;
                                                const isEnd =
                                                    day.dateString ===
                                                    selectedEndDate;
                                                const isToday =
                                                    day.dateString === today;
                                                const isInRange =
                                                    selectedStartDate &&
                                                    selectedEndDate &&
                                                    day.dateString >
                                                    selectedStartDate &&
                                                    day.dateString <
                                                    selectedEndDate;

                                                return (
                                                    <button
                                                        key={day.dateString}
                                                        type="button"
                                                        onClick={() =>
                                                            handleSelectDate(
                                                                day.dateString,
                                                            )
                                                        }
                                                        className={`mx-auto flex h-[34px] w-[34px] items-center justify-center rounded-[8px] text-[15px] font-medium transition-all ${isStart || isEnd
                                                            ? 'bg-[#739072] text-white'
                                                            : isInRange
                                                                ? 'bg-[#EEF3E9] text-[#4F6F52]'
                                                                : isToday
                                                                    ? 'bg-[#F8FAF6] text-[#4F6F52]'
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
                            className={`rounded-[50px] border py-1 md:py-2 px-2  text-[9px] md:text-[12px] font-bold shadow-sm transition-all ${isFilterOpen || activeFilterCount > 0
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

                            <Filter className="ml-[10px]  inline-block w-3 md:w-4 text-black" />
                        </button>

                        <button
                            type="button"
                            onClick={handleResetAll}
                            className="rounded-[50px] border border-[#BFC7BB] bg-white py-1 md:py-2 px-2 text-[9px] md:text-[12px] font-bold text-[#4B4B4B] shadow-sm transition-all hover:bg-[#F4F4F4]"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {isFilterOpen && (
                    <div className="mt-[18px] rounded-[16px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-[18px]">
                        <div className="grid w-full min-w-0 grid-cols-1 gap-[14px] md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto_auto] xl:items-end">
                            <label className="block min-w-0">
                                <span className="text-[11px] font-bold text-black">
                                    Tipe Transaksi
                                </span>

                                <select
                                    value={typeFilter}
                                    onChange={(event) =>
                                        setTypeFilter(event.target.value)
                                    }
                                    className="mt-[8px] h-[36px] w-full min-w-0 rounded-[8px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                >
                                    <option value="all">Semua Tipe</option>

                                    {filterOptions.types.map((type) => (
                                        <option key={type} value={type}>
                                            {formatEnumLabel(type)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block min-w-0">
                                <span className="text-[11px] font-bold text-black">
                                    Metode Pembayaran
                                </span>

                                <select
                                    value={methodFilter}
                                    onChange={(event) =>
                                        setMethodFilter(event.target.value)
                                    }
                                    className="mt-[8px] h-[36px] w-full min-w-0 rounded-[8px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                >
                                    <option value="all">Semua Metode</option>

                                    {filterOptions.methods.map((method) => (
                                        <option key={method} value={method}>
                                            {formatEnumLabel(method)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block min-w-0">
                                <span className="text-[11px] font-bold text-black">
                                    Status Pembayaran
                                </span>

                                <select
                                    value={statusFilter}
                                    onChange={(event) =>
                                        setStatusFilter(event.target.value)
                                    }
                                    className="mt-[8px] h-[36px] w-full min-w-0 rounded-[8px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                >
                                    <option value="all">Semua Status</option>

                                    {filterOptions.statuses.map((status) => (
                                        <option key={status} value={status}>
                                            {formatEnumLabel(status)}
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
                <div className="flex flex-col gap-[16px] border-b border-[#E4E8E1] px-5 py-[20px] sm:px-[26px] lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                            Daftar Keuangan
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-[10px]">
                        <button
                            type="button"
                            onClick={() =>
                                router.push('/financial-report/add-invoice')
                            }
                            className="flex items-center justify-center gap-x-2 rounded-[50px] bg-[#86A789] px-[9px] md:px-[18px] py-2 md:py-3 text-[9px] md:text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span>Tambah Invoice</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={
                                isLoading ||
                                isDownloading ||
                                filteredTransactions.length === 0
                            }
                            className="flex items-center justify-center gap-x-2 rounded-[50px] bg-[#86A789] px-[9px] md:px-[18px] py-2 md:py-3 text-[9px] md:text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FileDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span>
                                {isDownloading ? 'Mengunduh...' : 'Download'}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="block lg:hidden">
                    <div className="grid grid-cols-1 gap-[12px] px-4 py-4 sm:grid-cols-2">
                        {isLoading ? (
                            <div className="col-span-full rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[12px] text-gray-500">
                                Memuat data keuangan...
                            </div>
                        ) : currentTransactions.length === 0 ? (
                            <div className="col-span-full rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[12px] text-gray-500">
                                Tidak ada data keuangan untuk{' '}
                                {formattedSelectedDateRange}
                            </div>
                        ) : (
                            currentTransactions.map((transaction) => (
                                <button
                                    key={
                                        transaction.transaction_id ||
                                        transaction.transaction_number
                                    }
                                    type="button"
                                    onClick={() =>
                                        goToDetail(transaction.transaction_id)
                                    }
                                    className="w-full rounded-[16px] border border-[#E4E8E1] bg-white px-4 py-4 text-left shadow-sm transition-all hover:border-[#86A789] hover:bg-[#F8FAF6]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-[13px] font-bold text-black">
                                                {transaction.transaction_number ||
                                                    '-'}
                                            </p>

                                            <p className="mt-[5px] text-[11px] font-medium text-[#6B6B6B]">
                                                {formatShortDate(
                                                    transaction.payment_date,
                                                )}
                                            </p>
                                        </div>

                                        <span
                                            className={`inline-flex shrink-0 justify-center rounded-full px-3 py-1 text-[10px] font-bold ${getStatusBadgeClassName(
                                                transaction.status,
                                            )}`}
                                        >
                                            {formatEnumLabel(
                                                transaction.status,
                                            )}
                                        </span>
                                    </div>

                                    <div className="mt-[14px] grid grid-cols-2 gap-x-4 gap-y-3">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Tipe
                                            </p>

                                            <p className="mt-[4px] truncate text-[11px] font-semibold text-black">
                                                {formatEnumLabel(
                                                    transaction.trans_type,
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Metode
                                            </p>

                                            <p className="mt-[4px] truncate text-[11px] font-semibold text-black">
                                                {formatEnumLabel(
                                                    transaction.payment_method ||
                                                    '',
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Visit
                                            </p>

                                            <p className="mt-[4px] truncate text-[11px] font-semibold text-black">
                                                {getVisitDisplayText(
                                                    transaction,
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Nominal
                                            </p>

                                            <p className="mt-[4px] truncate text-[11px] font-semibold text-black">
                                                {formatRupiah(
                                                    transaction.amount,
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
                    <table className="w-full border-separate border-spacing-0 text-[12px]">
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
                                        Memuat data keuangan...
                                    </td>
                                </tr>
                            ) : currentTransactions.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={tableHeaders.length}
                                        className="px-6 py-20 text-center text-gray-400"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <p className="text-sm">
                                                Tidak ada data keuangan untuk{' '}
                                                {formattedSelectedDateRange}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                currentTransactions.map(
                                    (transaction, rowIndex) => (
                                        <tr
                                            key={
                                                transaction.transaction_id ||
                                                transaction.transaction_number
                                            }
                                            onClick={() =>
                                                goToDetail(
                                                    transaction.transaction_id,
                                                )
                                            }
                                            className={`cursor-pointer text-center text-black transition-all hover:bg-[#EEF3E9] ${rowIndex % 2 === 0
                                                ? 'bg-white'
                                                : 'bg-[#FBFCF8]'
                                                }`}
                                        >
                                            {tableHeaders.map((header) => (
                                                <td
                                                    key={header.key}
                                                    className="px-4 py-4"
                                                >
                                                    <div className="min-w-0 truncate">
                                                        {renderTableValue(
                                                            transaction,
                                                            header.key,
                                                        )}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    ),
                                )
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
                        to{' '}
                        <span className="font-semibold text-black">
                            {showingEnd}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-black">
                            {filteredTransactions.length}
                        </span>{' '}
                        records
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

export default FinancialReport;