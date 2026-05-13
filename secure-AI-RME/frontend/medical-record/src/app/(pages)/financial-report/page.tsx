'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarDays,
    faDownload,
    faFilter,
    faPlus,
    faSearch,
} from '@fortawesome/free-solid-svg-icons';
import LoadingOverlay from '@/components/loading'

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const FINANCIAL_ALLOWED_ROLES = ['admin', 'midwife'];

type FinancialTransaction = {
    transaction_id: string;
    visit_id: string;
    user_id: string;
    patient_id: string;
    transaction_number: string;
    trans_id: string;
    payment_date: string;
    trans_type: string;
    amount: number;
    payment_method: string;
    status: string;
    description: string;
    visit_display: string;
    record_number: string;
    record_type: string;
    patient_name: string;
    user_name: string;
};

type MeResponse = {
    msg?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role: string;
        clinic_id?: string | null;
    };
    clinic?: {
        id: string;
        clinic_name: string;
    } | null;
};

type TableKey =
    | 'transaction_number'
    | 'trans_id'
    | 'trans_type'
    | 'visit_display'
    | 'payment_method'
    | 'amount'
    | 'status';

type TableHeader = {
    label: string;
    key: TableKey;
    width: string;
};

type FilterOptions = {
    types: string[];
    methods: string[];
    statuses: string[];
};

type SummaryData = {
    totalRecords: number;
    totalAmount: number;
    incomeAmount: number;
    outcomeAmount: number;
};

const tableHeaders: TableHeader[] = [
    {
        label: 'Invoice No',
        key: 'transaction_number',
        width: 'w-[18%]',
    },
    {
        label: 'Trans ID',
        key: 'trans_id',
        width: 'w-[14%]',
    },
    {
        label: 'Type',
        key: 'trans_type',
        width: 'w-[12%]',
    },
    {
        label: 'Visit_ID',
        key: 'visit_display',
        width: 'w-[18%]',
    },
    {
        label: 'Method',
        key: 'payment_method',
        width: 'w-[14%]',
    },
    {
        label: 'Total Amount',
        key: 'amount',
        width: 'w-[16%]',
    },
    {
        label: 'Status',
        key: 'status',
        width: 'w-[12%]',
    },
];

const getTodayInputValue = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

    return date.toISOString().split('T')[0];
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

const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'All Dates';

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return 'Invalid Date';
    }

    return date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
};

const formatShortDate = (dateString: string) => {
    if (!dateString) return '-';

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
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

    return normalizedValue
        .split(' ')
        .filter(Boolean)
        .map(
            (word) =>
                word.charAt(0).toUpperCase() +
                word.slice(1).toLowerCase(),
        )
        .join(' ');
};

const escapeCsvValue = (value: string | number | null | undefined) => {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
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

    if (normalizedStatus === 'pending') {
        return 'bg-[#F3E8C8] text-[#7A5A00]';
    }

    if (
        normalizedStatus === 'unpaid' ||
        normalizedStatus === 'failed' ||
        normalizedStatus === 'cancelled' ||
        normalizedStatus === 'canceled'
    ) {
        return 'bg-red-50 text-red-600';
    }

    return 'bg-[#F2F2F2] text-[#5F5F5F]';
};

const FinancialReport = () => {
    const router = useRouter();
    const today = getTodayInputValue();
    const dateInputRef = useRef<HTMLInputElement | null>(null);

    const [selectedDate, setSelectedDate] = useState(today);
    const [searchQuery, setSearchQuery] = useState('');

    const [typeFilter, setTypeFilter] = useState('all');
    const [methodFilter, setMethodFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [transactions, setTransactions] = useState<FinancialTransaction[]>(
        [],
    );

    const [hasAccess, setHasAccess] = useState(false);
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const formattedSelectedDate = useMemo(() => {
        return formatDisplayDate(selectedDate);
    }, [selectedDate]);

    const getToken = () => {
        return Cookies.get('access_token');
    };

    const clearSession = () => {
        Cookies.remove('access_token');

        localStorage.removeItem('user_id');
        localStorage.removeItem('fullname');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('clinic_id');
    };

    const handleUnauthorized = () => {
        clearSession();
        router.push('/login');
    };

    const handleForbidden = () => {
        router.replace('/dashboard');
    };

    const checkFinancialAccess = async () => {
        try {
            setIsCheckingAccess(true);
            setErrorMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = (await readJson(response)) as MeResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok || !data.user) {
                throw new Error(data?.msg || 'Gagal mengecek akses user');
            }

            if (!FINANCIAL_ALLOWED_ROLES.includes(data.user.role)) {
                handleForbidden();
                return;
            }

            localStorage.setItem('user_id', data.user.id || '');
            localStorage.setItem('fullname', data.user.fullname || '');
            localStorage.setItem('user_email', data.user.email || '');
            localStorage.setItem('user_role', data.user.role || '');
            localStorage.setItem('clinic_id', data.user.clinic_id || '');

            setHasAccess(true);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengecek akses';

            setErrorMessage(message);
        } finally {
            setIsCheckingAccess(false);
        }
    };

    const openDatePicker = () => {
        const input = dateInputRef.current as
            | (HTMLInputElement & { showPicker?: () => void })
            | null;

        if (!input) return;

        if (typeof input.showPicker === 'function') {
            input.showPicker();
            return;
        }

        input.click();
        input.focus();
    };

    const fetchFinancialTransactions = async (dateValue: string) => {
        try {
            setIsLoading(true);
            setErrorMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const params = new URLSearchParams();

            if (dateValue) {
                params.set('date', dateValue);
            }

            const queryString = params.toString();

            const response = await fetch(
                `${API_BASE_URL}/financial/get-all${
                    queryString ? `?${queryString}` : ''
                }`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            const data = await readJson(response);

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal mengambil data financial');
            }

            setTransactions(Array.isArray(data) ? data : []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil data financial';

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

        fetchFinancialTransactions(selectedDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess, selectedDate]);

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

        return transactions.filter((transaction) => {
            const matchesDate = selectedDate
                ? transaction.payment_date === selectedDate
                : true;

            const searchableText = [
                transaction.transaction_number,
                transaction.trans_id,
                transaction.payment_date,
                transaction.trans_type,
                transaction.visit_display,
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
                matchesDate &&
                matchesSearch &&
                matchesType &&
                matchesMethod &&
                matchesStatus
            );
        });
    }, [
        transactions,
        selectedDate,
        searchQuery,
        typeFilter,
        methodFilter,
        statusFilter,
    ]);

    const summaryData = useMemo<SummaryData>(() => {
        return filteredTransactions.reduce(
            (summary, transaction) => {
                const amount = Number(transaction.amount || 0);
                const type = safeLower(transaction.trans_type);

                summary.totalRecords += 1;
                summary.totalAmount += amount;

                if (type === 'income') {
                    summary.incomeAmount += amount;
                }

                if (type === 'outcome' || type === 'expense') {
                    summary.outcomeAmount += amount;
                }

                return summary;
            },
            {
                totalRecords: 0,
                totalAmount: 0,
                incomeAmount: 0,
                outcomeAmount: 0,
            },
        );
    }, [filteredTransactions]);

    const activeFilterCount = useMemo(() => {
        return [typeFilter, methodFilter, statusFilter].filter(
            (value) => value !== 'all',
        ).length;
    }, [typeFilter, methodFilter, statusFilter]);

    const handleDateChange = (value: string) => {
        setSelectedDate(value);
        setTypeFilter('all');
        setMethodFilter('all');
        setStatusFilter('all');
    };

    const handleClearFilter = () => {
        setTypeFilter('all');
        setMethodFilter('all');
        setStatusFilter('all');
    };

    const handleResetAll = () => {
        setSelectedDate(today);
        setSearchQuery('');
        setTypeFilter('all');
        setMethodFilter('all');
        setStatusFilter('all');
        setIsFilterOpen(false);
    };

    const handleShowAllDates = () => {
        setSelectedDate('');
        setTypeFilter('all');
        setMethodFilter('all');
        setStatusFilter('all');
    };

    const handleDownload = () => {
        const headerRow = tableHeaders
            .map((header) => escapeCsvValue(header.label))
            .join(',');

        const dataRows = filteredTransactions.map((transaction) =>
            tableHeaders
                .map((header) => {
                    if (header.key === 'amount') {
                        return escapeCsvValue(formatRupiah(transaction.amount));
                    }

                    if (header.key === 'trans_id') {
                        return escapeCsvValue(
                            transaction.trans_id || transaction.payment_date,
                        );
                    }

                    return escapeCsvValue(transaction[header.key]);
                })
                .join(','),
        );

        const summaryRows = [
            '',
            [
                escapeCsvValue('Selected Date'),
                escapeCsvValue(formattedSelectedDate),
            ].join(','),
            [
                escapeCsvValue('Total Records'),
                escapeCsvValue(summaryData.totalRecords),
            ].join(','),
            [
                escapeCsvValue('Total Amount'),
                escapeCsvValue(formatRupiah(summaryData.totalAmount)),
            ].join(','),
            [
                escapeCsvValue('Total Income'),
                escapeCsvValue(formatRupiah(summaryData.incomeAmount)),
            ].join(','),
            [
                escapeCsvValue('Total Outcome'),
                escapeCsvValue(formatRupiah(summaryData.outcomeAmount)),
            ].join(','),
        ];

        const csvContent = [
            headerRow,
            ...dataRows,
            ...summaryRows,
        ].join('\n');

        const blob = new Blob([`\uFEFF${csvContent}`], {
            type: 'text/csv;charset=utf-8;',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `financial-report-${selectedDate || 'all-dates'}.csv`;
        link.click();

        URL.revokeObjectURL(url);
    };

    const renderTableValue = (
        transaction: FinancialTransaction,
        key: TableKey,
    ) => {
        if (key === 'amount') {
            return formatRupiah(transaction.amount);
        }

        if (key === 'trans_id') {
            return formatShortDate(
                transaction.trans_id || transaction.payment_date,
            );
        }

        if (key === 'trans_type' || key === 'payment_method') {
            return formatEnumLabel(String(transaction[key]));
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

    if (isCheckingAccess) {
        return (
            <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#FDFEF9]">
                {isLoading && <LoadingOverlay />}
                <div className="flex min-h-dvh w-full max-w-full overflow-x-hidden">

                    <main className="box-border flex min-w-0 flex-1 items-center justify-center overflow-x-hidden bg-[#FDFEF9] pb-[40px] pl-4 pr-0 pt-[26px] sm:pl-[28px] sm:pr-0">
                        <p className="text-[14px] font-bold text-[#5F785F]">
                            Checking financial access...
                        </p>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#FDFEF9]">
            <div className="flex min-h-dvh w-full max-w-full overflow-x-hidden">

                <main className="box-border flex min-w-0 flex-1 flex-col overflow-x-hidden bg-[#FDFEF9] pb-[44px] pl-4 pr-0 pt-[26px] sm:pl-[28px]">
                    <div className="box-border flex w-full min-w-0 flex-1 flex-col gap-[22px]">
                        <section className="box-border w-full rounded-l-[18px] bg-[#86A789] px-5 py-[26px] shadow-md sm:px-[32px]">
                            <div className="flex flex-col gap-[22px] xl:flex-row xl:items-center xl:justify-between">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                                        Financial Report
                                    </p>

                                    <h1 className="mt-[10px] text-[30px] font-bold leading-none text-white">
                                        Laporan Keuangan
                                    </h1>

                                    <p className="mt-[10px] max-w-[620px] text-[12px] font-medium leading-relaxed text-white/90">
                                        Pantau pemasukan, pengeluaran, invoice,
                                        metode pembayaran, dan status transaksi
                                        klinik dalam satu halaman.
                                    </p>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center gap-[12px]">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.push(
                                                '/financial-report/add-invoice',
                                            )
                                        }
                                        className="flex h-[40px] items-center justify-center gap-x-2 rounded-[50px] bg-white px-[20px] text-[12px] font-bold text-[#5F785F] shadow-sm transition-all hover:bg-[#F4F4F4]"
                                    >
                                        <FontAwesomeIcon
                                            icon={faPlus}
                                            className="w-4"
                                        />
                                        <span>Add Invoice</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleDownload}
                                        disabled={
                                            isLoading ||
                                            filteredTransactions.length === 0
                                        }
                                        className="flex h-[40px] items-center justify-center gap-x-2 rounded-[50px] border border-white/50 bg-white/10 px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <FontAwesomeIcon
                                            icon={faDownload}
                                            className="w-4"
                                        />
                                        <span>Download</span>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-[24px] grid w-full min-w-0 grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-[14px] bg-white px-[18px] py-[16px] shadow-sm">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                        Records
                                    </p>
                                    <p className="mt-[8px] text-[26px] font-bold leading-none text-black">
                                        {summaryData.totalRecords}
                                    </p>
                                    <p className="mt-[7px] text-[10px] font-medium text-[#6B6B6B]">
                                        Transaction(s)
                                    </p>
                                </div>

                                <div className="rounded-[14px] bg-white px-[18px] py-[16px] shadow-sm">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                        Income
                                    </p>
                                    <p className="mt-[8px] truncate text-[18px] font-bold leading-none text-black">
                                        {formatRupiah(summaryData.incomeAmount)}
                                    </p>
                                    <p className="mt-[7px] text-[10px] font-medium text-[#6B6B6B]">
                                        Total pemasukan
                                    </p>
                                </div>

                                <div className="rounded-[14px] bg-white px-[18px] py-[16px] shadow-sm">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                        Outcome
                                    </p>
                                    <p className="mt-[8px] truncate text-[18px] font-bold leading-none text-black">
                                        {formatRupiah(summaryData.outcomeAmount)}
                                    </p>
                                    <p className="mt-[7px] text-[10px] font-medium text-[#6B6B6B]">
                                        Total pengeluaran
                                    </p>
                                </div>

                                <div className="rounded-[14px] bg-white px-[18px] py-[16px] shadow-sm">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                        Total Amount
                                    </p>
                                    <p className="mt-[8px] truncate text-[18px] font-bold leading-none text-black">
                                        {formatRupiah(summaryData.totalAmount)}
                                    </p>
                                    <p className="mt-[7px] text-[10px] font-medium text-[#6B6B6B]">
                                        Semua transaksi
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="box-border w-full rounded-l-[18px] border border-r-0 border-[#D2D8CF] bg-white px-5 py-[22px] shadow-sm sm:px-[26px]">
                            <div className="flex flex-col gap-[16px] xl:flex-row xl:items-center xl:justify-between">
                                <div className="relative min-w-0 flex-1 rounded-[50px] border border-[#D2D8CF] bg-[#FDFEF9] px-5 py-[12px] shadow-sm transition-all focus-within:border-[#739072] xl:max-w-[620px]">
                                    <FontAwesomeIcon
                                        icon={faSearch}
                                        className="absolute left-5 top-1/2 w-4 -translate-y-1/2 text-gray-400"
                                    />

                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(event) =>
                                            setSearchQuery(event.target.value)
                                        }
                                        placeholder="Search invoice, visit, method, status, patient, amount..."
                                        className="w-full bg-transparent pl-8 text-[13px] text-gray-700 outline-none placeholder-gray-400"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-[10px]">
                                    <div className="rounded-[50px] bg-[#D2E3C8] px-[20px] py-[11px] text-center text-[12px] font-bold text-black shadow-sm">
                                        {formattedSelectedDate}
                                    </div>

                                    <div className="relative inline-block">
                                        <button
                                            type="button"
                                            onClick={openDatePicker}
                                            className="rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] py-[11px] text-[12px] font-bold text-[#4B4B4B] shadow-sm transition-all hover:border-[#739072] hover:bg-[#F9FBF7]"
                                        >
                                            <span>Select Date</span>
                                            <FontAwesomeIcon
                                                icon={faCalendarDays}
                                                className="ml-[10px] w-4 text-black"
                                            />
                                        </button>

                                        <input
                                            ref={dateInputRef}
                                            type="date"
                                            value={selectedDate}
                                            onChange={(event) =>
                                                handleDateChange(
                                                    event.target.value,
                                                )
                                            }
                                            className="absolute left-1/2 top-1/2 h-[1px] w-[1px] -translate-x-1/2 -translate-y-1/2 opacity-0"
                                            tabIndex={-1}
                                            aria-hidden="true"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsFilterOpen(
                                                (current) => !current,
                                            )
                                        }
                                        className={`rounded-[50px] border px-[18px] py-[11px] text-[12px] font-bold shadow-sm transition-all ${
                                            isFilterOpen ||
                                            activeFilterCount > 0
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
                                        <FontAwesomeIcon
                                            icon={faFilter}
                                            className="ml-[10px] w-4 text-black"
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleResetAll}
                                        className="rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] py-[11px] text-[12px] font-bold text-[#4B4B4B] shadow-sm transition-all hover:bg-[#F4F4F4]"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>

                            {isFilterOpen && (
                                <div className="mt-[18px] rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-[18px]">
                                    <div className="grid w-full min-w-0 grid-cols-1 gap-[14px] md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto_auto] xl:items-end">
                                        <label className="block min-w-0">
                                            <span className="text-[11px] font-bold text-black">
                                                Type
                                            </span>
                                            <select
                                                value={typeFilter}
                                                onChange={(event) =>
                                                    setTypeFilter(
                                                        event.target.value,
                                                    )
                                                }
                                                className="mt-[8px] h-[36px] w-full min-w-0 rounded-[8px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                            >
                                                <option value="all">
                                                    All Type
                                                </option>
                                                {filterOptions.types.map(
                                                    (type) => (
                                                        <option
                                                            key={type}
                                                            value={type}
                                                        >
                                                            {formatEnumLabel(
                                                                type,
                                                            )}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>

                                        <label className="block min-w-0">
                                            <span className="text-[11px] font-bold text-black">
                                                Method
                                            </span>
                                            <select
                                                value={methodFilter}
                                                onChange={(event) =>
                                                    setMethodFilter(
                                                        event.target.value,
                                                    )
                                                }
                                                className="mt-[8px] h-[36px] w-full min-w-0 rounded-[8px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                            >
                                                <option value="all">
                                                    All Method
                                                </option>
                                                {filterOptions.methods.map(
                                                    (method) => (
                                                        <option
                                                            key={method}
                                                            value={method}
                                                        >
                                                            {formatEnumLabel(
                                                                method,
                                                            )}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>

                                        <label className="block min-w-0">
                                            <span className="text-[11px] font-bold text-black">
                                                Status
                                            </span>
                                            <select
                                                value={statusFilter}
                                                onChange={(event) =>
                                                    setStatusFilter(
                                                        event.target.value,
                                                    )
                                                }
                                                className="mt-[8px] h-[36px] w-full min-w-0 rounded-[8px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                            >
                                                <option value="all">
                                                    All Status
                                                </option>
                                                {filterOptions.statuses.map(
                                                    (status) => (
                                                        <option
                                                            key={status}
                                                            value={status}
                                                        >
                                                            {formatEnumLabel(
                                                                status,
                                                            )}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={handleShowAllDates}
                                            className="h-[36px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-[#4B4B4B] transition-all hover:bg-[#F4F4F4]"
                                        >
                                            All Dates
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleClearFilter}
                                            className="h-[36px] rounded-[50px] bg-[#86A789] px-[18px] text-[12px] font-bold text-white transition-all hover:bg-[#739072]"
                                        >
                                            Clear Filter
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>

                        {errorMessage && (
                            <div className="box-border w-full rounded-l-[8px] border border-red-200 bg-red-50 px-[16px] py-[12px] text-[12px] font-medium text-red-700">
                                {errorMessage}
                            </div>
                        )}

                        <section className="box-border w-full overflow-hidden rounded-l-[18px] border border-r-0 border-[#D2D8CF] bg-white shadow-sm">
                            <div className="flex flex-col gap-[8px] border-b border-[#E4E8E1] px-5 py-[20px] sm:flex-row sm:items-center sm:justify-between sm:px-[26px]">
                                <div>
                                    <h2 className="text-[20px] font-bold leading-none text-[#5F785F]">
                                        Financial List
                                    </h2>
                                    <p className="mt-[7px] text-[11px] text-[#5F5F5F]">
                                        Showing{' '}
                                        <span className="font-bold text-black">
                                            {filteredTransactions.length}
                                        </span>{' '}
                                        transaction(s)
                                        {selectedDate
                                            ? ` on ${formattedSelectedDate}`
                                            : ' for all dates'}
                                    </p>
                                </div>

                                <div className="rounded-[50px] bg-[#F8FAF6] px-[14px] py-[7px] text-[11px] font-bold text-[#5F785F]">
                                    {isLoading
                                        ? 'Loading data...'
                                        : 'Data ready'}
                                </div>
                            </div>

                            <div className="w-full overflow-x-auto">
                                <table className="w-full min-w-[1050px] divide-y divide-gray-200 text-[11px]">
                                    <thead className="bg-[#D2E3C8] font-semibold text-gray-700">
                                        <tr>
                                            {tableHeaders.map(
                                                (header, index) => (
                                                    <th
                                                        key={header.key}
                                                        className={`px-6 py-4 text-center ${
                                                            header.width
                                                        } ${
                                                            index !==
                                                            tableHeaders.length -
                                                                1
                                                                ? 'border-r border-gray-200'
                                                                : ''
                                                        }`}
                                                    >
                                                        {header.label}
                                                    </th>
                                                ),
                                            )}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {isLoading ? (
                                            <tr>
                                                <td
                                                    colSpan={
                                                        tableHeaders.length
                                                    }
                                                    className="px-6 py-10 text-center text-gray-500"
                                                >
                                                    Loading financial data...
                                                </td>
                                            </tr>
                                        ) : filteredTransactions.length ===
                                          0 ? (
                                            <tr>
                                                <td
                                                    colSpan={
                                                        tableHeaders.length
                                                    }
                                                    className="px-6 py-12 text-center text-gray-500"
                                                >
                                                    No financial data found for{' '}
                                                    {formattedSelectedDate}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTransactions.map(
                                                (transaction) => (
                                                    <tr
                                                        key={
                                                            transaction.transaction_id ||
                                                            transaction.transaction_number
                                                        }
                                                        className="border-b border-gray-100 bg-white text-center text-black transition-all hover:bg-[#F8FAF6]"
                                                    >
                                                        {tableHeaders.map(
                                                            (
                                                                header,
                                                                index,
                                                            ) => (
                                                                <td
                                                                    key={
                                                                        header.key
                                                                    }
                                                                    className={`px-6 py-4 ${
                                                                        index !==
                                                                        tableHeaders.length -
                                                                            1
                                                                            ? 'border-r border-gray-100'
                                                                            : ''
                                                                    }`}
                                                                >
                                                                    <div className="min-w-0 truncate">
                                                                        {renderTableValue(
                                                                            transaction,
                                                                            header.key,
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            ),
                                                        )}
                                                    </tr>
                                                ),
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default FinancialReport;