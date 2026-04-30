'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '@/components/sidebar';
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
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const formattedSelectedDate = useMemo(() => {
        return formatDisplayDate(selectedDate);
    }, [selectedDate]);

    const getToken = () => {
        return Cookies.get('access_token');
    };

    const handleUnauthorized = () => {
        Cookies.remove('access_token');
        router.push('/login');
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
        fetchFinancialTransactions(selectedDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]);

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

    return (
        <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#FDFEF9]">
            <div className="flex min-h-dvh w-full max-w-full overflow-x-hidden">
                <Sidebar />

                <main className="box-border flex min-w-0 flex-1 flex-col overflow-x-hidden bg-[#FDFEF9] pb-[40px] pl-4 pr-0 pt-[26px] sm:pl-[28px] sm:pr-0">
                    <div className="box-border flex w-full min-w-0 flex-1 flex-col">
                        <div className="box-border flex w-full flex-col gap-[16px] py-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative min-w-0 flex-1 rounded-lg bg-white px-4 py-2 shadow-sm outline outline-1 outline-gray-300 transition-all focus-within:outline-[#739072] lg:max-w-[720px]">
                                <FontAwesomeIcon
                                    icon={faSearch}
                                    className="absolute left-4 top-1/2 w-4 -translate-y-1/2 text-gray-400"
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

                            <div className="flex shrink-0 flex-wrap items-center gap-[12px]">
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            '/financial-report/add-invoice',
                                        )
                                    }
                                    className="flex h-[36px] shrink-0 cursor-pointer flex-row items-center gap-x-2 rounded-[50px] bg-[#86A789] px-5 text-[12px] font-bold text-black shadow-sm transition-all hover:bg-[#739072]"
                                >
                                    <FontAwesomeIcon
                                        icon={faPlus}
                                        className="w-4 text-black"
                                    />

                                    <span className="whitespace-nowrap">
                                        Add invoice
                                    </span>
                                </button>
                            </div>
                        </div>

                        <h2 className="text-[24px] font-semibold leading-none text-[#5F785F]">
                            Financial List
                        </h2>

                        <div className="mt-[18px] box-border flex w-full flex-col gap-[16px] xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
                                <div className="min-w-[260px] rounded-[50px] bg-[#D2E3C8] px-6 py-3 text-center text-[14px] font-bold text-black shadow-sm sm:min-w-[342px]">
                                    {formattedSelectedDate}
                                </div>

                                <div className="relative inline-block">
                                    <button
                                        type="button"
                                        onClick={openDatePicker}
                                        className="min-w-[230px] rounded-[50px] border border-gray-400 bg-white px-6 py-3 text-center text-[14px] text-[#4B4B4B] shadow-sm transition-all hover:border-[#739072] hover:bg-[#F9FBF7] sm:min-w-[270px]"
                                    >
                                        <span>Select Date</span>

                                        <FontAwesomeIcon
                                            icon={faCalendarDays}
                                            className="ml-[12px] w-4 text-black"
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
                                    className={`min-w-[150px] rounded-[50px] border px-6 py-3 text-center text-[14px] shadow-sm transition-all ${
                                        isFilterOpen || activeFilterCount > 0
                                            ? 'border-[#739072] bg-[#EEF3E9] text-[#4F6F52]'
                                            : 'border-gray-400 bg-white text-[#4B4B4B] hover:border-[#739072] hover:bg-[#F9FBF7]'
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
                                    onClick={handleDownload}
                                    disabled={
                                        isLoading ||
                                        filteredTransactions.length === 0
                                    }
                                    className="min-w-[150px] rounded-[50px] border border-gray-400 bg-white px-6 py-3 text-center text-[14px] text-[#4B4B4B] shadow-sm transition-all hover:border-[#739072] hover:bg-[#F9FBF7] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <span>Download</span>

                                    <FontAwesomeIcon
                                        icon={faDownload}
                                        className="ml-[10px] w-4 text-black"
                                    />
                                </button>
                            </div>

                            <div className="grid min-w-0 grid-cols-1 gap-[10px] sm:grid-cols-3 xl:min-w-[520px]">
                                <div className="rounded-[10px] border border-[#D2D8CF] bg-white px-[16px] py-[12px] shadow-sm">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                        Records
                                    </p>

                                    <p className="mt-[5px] text-[18px] font-bold text-black">
                                        {summaryData.totalRecords}
                                    </p>
                                </div>

                                <div className="rounded-[10px] border border-[#D2D8CF] bg-white px-[16px] py-[12px] shadow-sm">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                        Income
                                    </p>

                                    <p className="mt-[5px] truncate text-[14px] font-bold text-black">
                                        {formatRupiah(summaryData.incomeAmount)}
                                    </p>
                                </div>

                                <div className="rounded-[10px] border border-[#D2D8CF] bg-white px-[16px] py-[12px] shadow-sm">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                        Outcome
                                    </p>

                                    <p className="mt-[5px] truncate text-[14px] font-bold text-black">
                                        {formatRupiah(summaryData.outcomeAmount)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {isFilterOpen && (
                            <div className="mt-[14px] box-border w-full rounded-l-[10px] border border-r-0 border-[#D2D8CF] bg-white px-4 py-[18px] shadow-sm sm:px-[24px]">
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
                                            className="mt-[8px] h-[34px] w-full min-w-0 rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                        >
                                            <option value="all">
                                                All Type
                                            </option>

                                            {filterOptions.types.map((type) => (
                                                <option
                                                    key={type}
                                                    value={type}
                                                >
                                                    {formatEnumLabel(type)}
                                                </option>
                                            ))}
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
                                            className="mt-[8px] h-[34px] w-full min-w-0 rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
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
                                                        {formatEnumLabel(method)}
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
                                            className="mt-[8px] h-[34px] w-full min-w-0 rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
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
                                                        {formatEnumLabel(status)}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={handleShowAllDates}
                                        className="h-[34px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-[#4B4B4B] transition-all hover:bg-[#F4F4F4]"
                                    >
                                        All Dates
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleClearFilter}
                                        className="h-[34px] rounded-[50px] bg-[#86A789] px-[18px] text-[12px] font-bold text-white transition-all hover:bg-[#739072]"
                                    >
                                        Clear Filter
                                    </button>
                                </div>
                            </div>
                        )}

                        {errorMessage && (
                            <div className="mt-4 box-border w-full rounded-l-[6px] border border-red-200 bg-red-50 px-[16px] py-[10px] text-[12px] font-medium text-red-700">
                                {errorMessage}
                            </div>
                        )}

                        <div className="mt-5 box-border w-full overflow-x-auto rounded-l-[10px] border border-r-0 border-[#D2D8CF] bg-white shadow-sm">
                            <table className="w-full min-w-[1050px] divide-y divide-gray-200 text-[11px]">
                                <thead className="bg-[#D2E3C8] font-semibold text-gray-700">
                                    <tr>
                                        {tableHeaders.map((header, index) => (
                                            <th
                                                key={header.key}
                                                className={`px-6 py-4 text-center ${
                                                    header.width
                                                } ${
                                                    index !==
                                                    tableHeaders.length - 1
                                                        ? 'border-r border-gray-200'
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
                                                className="px-6 py-8 text-center text-gray-500"
                                            >
                                                Loading financial data...
                                            </td>
                                        </tr>
                                    ) : filteredTransactions.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={tableHeaders.length}
                                                className="px-6 py-8 text-center text-gray-500"
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
                                                        (header, index) => (
                                                            <td
                                                                key={header.key}
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

                        <div className="mt-[14px] flex flex-wrap items-center justify-between gap-[10px] pr-4 text-[11px] text-[#5F5F5F] sm:pr-[28px]">
                            <p>
                                Showing{' '}
                                <span className="font-bold text-black">
                                    {filteredTransactions.length}
                                </span>{' '}
                                transaction(s)
                                {selectedDate
                                    ? ` on ${formattedSelectedDate}`
                                    : ' for all dates'}
                            </p>

                            <button
                                type="button"
                                onClick={handleResetAll}
                                className="rounded-[50px] border border-[#BFC7BB] bg-white px-[16px] py-[7px] text-[11px] font-bold text-[#4B4B4B] transition-all hover:bg-[#F4F4F4]"
                            >
                                Reset to Today
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default FinancialReport;