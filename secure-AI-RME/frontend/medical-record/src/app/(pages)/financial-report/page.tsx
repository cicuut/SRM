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

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const FINANCIAL_ALLOWED_ROLES = ['admin', 'midwife'];

type FinancialTransaction = {
    transaction_id: string;
    visit_id: string | null;
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

const tableHeaders: TableHeader[] = [
    {
        label: 'Invoice No',
        key: 'transaction_number',
        width: 'w-[17%]',
    },
    {
        label: 'Tanggal',
        key: 'trans_id',
        width: 'w-[13%]',
    },
    {
        label: 'Tipe',
        key: 'trans_type',
        width: 'w-[12%]',
    },
    {
        label: 'Visit / Record',
        key: 'visit_display',
        width: 'w-[18%]',
    },
    {
        label: 'Metode',
        key: 'payment_method',
        width: 'w-[13%]',
    },
    {
        label: 'Nominal',
        key: 'amount',
        width: 'w-[16%]',
    },
    {
        label: 'Status',
        key: 'status',
        width: 'w-[11%]',
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
    if (!dateString) return 'Semua Tanggal';

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return 'Tanggal Tidak Valid';
    }

    return date.toLocaleDateString('id-ID', {
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
    if (lowerValue === 'pemasukan') return 'Pemasukan';
    if (lowerValue === 'pengeluaran') return 'Pengeluaran';

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

    if (normalizedStatus === 'unpaid') {
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
    const [isLoading, setIsLoading] = useState(false);
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
                throw new Error(data?.msg || 'Gagal mengambil data keuangan');
            }

            setTransactions(Array.isArray(data) ? data : []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil data keuangan';

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
                escapeCsvValue('Tanggal Terpilih'),
                escapeCsvValue(formattedSelectedDate),
            ].join(','),
            [
                escapeCsvValue('Total Records'),
                escapeCsvValue(filteredTransactions.length),
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
            <div className="flex min-h-[calc(100dvh-48px)] w-full items-center justify-center">
                <p className="text-[14px] font-bold text-[#5F785F]">
                    Memeriksa akses laporan keuangan...
                </p>
            </div>
        );
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-5">
                <section className="w-full rounded-[22px] bg-[#86A789] px-6 py-7 shadow-md sm:px-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                            Financial Report
                        </p>

                        <h2 className="mt-[10px] text-[30px] font-extrabold leading-none text-white">
                            Laporan Keuangan
                        </h2>

                        <p className="mt-[10px] max-w-[760px] text-[12px] font-medium leading-relaxed text-white/90">
                            Pantau invoice, metode pembayaran, status
                            transaksi, dan data pembayaran klinik dalam satu
                            halaman.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            router.push('/financial-report/add-invoice')
                        }
                        className="flex h-[40px] w-fit items-center justify-center gap-x-2 rounded-[50px] bg-white px-[20px] text-[12px] font-bold text-[#5F785F] shadow-sm transition-all hover:bg-[#F4F4F4]"
                    >
                        <FontAwesomeIcon icon={faPlus} className="w-4" />
                        <span>Tambah Invoice</span>
                    </button>
                </div>
            </section>

            <section className="w-full rounded-[22px] border border-[#D2D8CF] bg-white px-5 py-5 shadow-sm sm:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative min-w-0 flex-1 rounded-[50px] border border-[#D2D8CF] bg-[#FDFEF9] px-5 py-[12px] shadow-sm transition-all focus-within:border-[#739072] xl:max-w-[680px]">
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
                            placeholder="Cari invoice, visit, metode, status, pasien, nominal..."
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
                                <span>Pilih Tanggal</span>

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
                                    handleDateChange(event.target.value)
                                }
                                className="absolute left-1/2 top-1/2 h-[1px] w-[1px] -translate-x-1/2 -translate-y-1/2 opacity-0"
                                tabIndex={-1}
                                aria-hidden="true"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setIsFilterOpen((current) => !current)
                            }
                            className={`rounded-[50px] border px-[18px] py-[11px] text-[12px] font-bold shadow-sm transition-all ${
                                isFilterOpen || activeFilterCount > 0
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
                    <div className="mt-[18px] rounded-[16px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-[18px]">
                        <div className="grid w-full min-w-0 grid-cols-1 gap-[14px] md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto_auto] xl:items-end">
                            <label className="block min-w-0">
                                <span className="text-[11px] font-bold text-black">
                                    Tipe
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
                                    Metode
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
                                    Status
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

            <section className="w-full overflow-hidden rounded-[22px] border border-[#D2D8CF] bg-white shadow-sm">
                <div className="flex flex-col gap-[16px] border-b border-[#E4E8E1] px-5 py-[20px] lg:flex-row lg:items-center lg:justify-between sm:px-[26px]">
                    <div className="min-w-0">
                        <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                            Financial List
                        </h2>

                        <p className="mt-[7px] text-[11px] text-[#5F5F5F]">
                            Menampilkan{' '}
                            <span className="font-bold text-black">
                                {filteredTransactions.length}
                            </span>{' '}
                            transaksi
                            {selectedDate
                                ? ` pada ${formattedSelectedDate}`
                                : ' dari semua tanggal'}
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-[10px] sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:justify-end">
                        <div className="flex min-h-[38px] items-center justify-between rounded-[12px] border border-[#D2D8CF] bg-[#F8FAF6] px-[14px] py-[9px] sm:min-w-[156px]">
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                    Records
                                </p>

                                <p className="mt-[3px] text-[17px] font-bold leading-none text-black">
                                    {filteredTransactions.length}
                                </p>
                            </div>

                            <p className="text-[10px] font-semibold text-[#6B6B6B]">
                                Data
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={
                                isLoading || filteredTransactions.length === 0
                            }
                            className="flex min-h-[38px] items-center justify-center gap-x-2 rounded-[50px] bg-[#86A789] px-[18px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FontAwesomeIcon
                                icon={faDownload}
                                className="w-4"
                            />
                            <span>Download</span>
                        </button>
                    </div>
                </div>

                <div className="block lg:hidden">
                    <div className="grid grid-cols-1 gap-[12px] px-4 py-4 sm:grid-cols-2">
                        {isLoading ? (
                            <div className="col-span-full rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[12px] text-gray-500">
                                Memuat data keuangan...
                            </div>
                        ) : filteredTransactions.length === 0 ? (
                            <div className="col-span-full rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[12px] text-gray-500">
                                Tidak ada data keuangan untuk{' '}
                                {formattedSelectedDate}
                            </div>
                        ) : (
                            filteredTransactions.map((transaction) => (
                                <button
                                    key={
                                        transaction.transaction_id ||
                                        transaction.transaction_number
                                    }
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            `/financial-report/${transaction.transaction_id}`,
                                        )
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
                                                    transaction.trans_id ||
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
                                                    transaction.payment_method,
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                Visit
                                            </p>

                                            <p className="mt-[4px] truncate text-[11px] font-semibold text-black">
                                                {transaction.visit_display ||
                                                    '-'}
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
                    <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-[11px]">
                        <thead>
                            <tr className="bg-[#D2E3C8] text-gray-700">
                                {tableHeaders.map((header, index) => (
                                    <th
                                        key={header.key}
                                        className={`px-6 py-4 text-center font-bold ${
                                            header.width
                                        } ${
                                            index !== tableHeaders.length - 1
                                                ? 'border-r border-[#BFC7BB]'
                                                : ''
                                        }`}
                                    >
                                        {header.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td
                                        colSpan={tableHeaders.length}
                                        className="px-6 py-10 text-center text-gray-500"
                                    >
                                        Memuat data keuangan...
                                    </td>
                                </tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={tableHeaders.length}
                                        className="px-6 py-12 text-center text-gray-500"
                                    >
                                        Tidak ada data keuangan untuk{' '}
                                        {formattedSelectedDate}
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map(
                                    (transaction, rowIndex) => (
                                        <tr
                                            key={
                                                transaction.transaction_id ||
                                                transaction.transaction_number
                                            }
                                            onClick={() =>
                                                router.push(
                                                    `/financial-report/${transaction.transaction_id}`,
                                                )
                                            }
                                            className={`cursor-pointer text-center text-black transition-all hover:bg-[#EEF3E9] ${
                                                rowIndex % 2 === 0
                                                    ? 'bg-white'
                                                    : 'bg-[#FBFCF8]'
                                            }`}
                                        >
                                            {tableHeaders.map(
                                                (header, index) => (
                                                    <td
                                                        key={header.key}
                                                        className={`border-b border-[#E4E8E1] px-6 py-4 ${
                                                            index !==
                                                            tableHeaders.length -
                                                                1
                                                                ? 'border-r border-[#EEF0EC]'
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
    );
};

export default FinancialReport;