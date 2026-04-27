'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '@/components/sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch,
    faFilter,
    faPlus,
    faCalendarDays,
    faFileArrowDown,
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

const tableHeaders: {
    label: string;
    key: TableKey;
    width: string;
}[] = [
    {
        label: 'Invoice No',
        key: 'transaction_number',
        width: 'w-[14%]',
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

const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Select Date';

    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'long',
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

    const lowerValue = value.toLowerCase();

    if (lowerValue === 'qris') return 'QRIS';

    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const escapeCsvValue = (value: string | number) => {
    return `"${String(value).replace(/"/g, '""')}"`;
};

const Financial = () => {
    const router = useRouter();
    const today = getTodayInputValue();

    const [selectedDate, setSelectedDate] = useState(today);
    const [filterDate, setFilterDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const fetchFinancialTransactions = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');

            const token = Cookies.get('access_token');

            const response = await fetch(`${API_BASE_URL}/financial/get-all`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal mengambil data financial');
            }

            setTransactions(data);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil data financial';

            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFinancialTransactions();
    }, []);

    const formattedSelectedDate = useMemo(() => {
        return formatDisplayDate(selectedDate);
    }, [selectedDate]);

    const filteredTransactions = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();

        return transactions.filter((transaction) => {
            const matchesSearch =
                normalizedSearch.length === 0 ||
                [
                    transaction.transaction_number,
                    transaction.trans_id,
                    transaction.trans_type,
                    transaction.visit_display,
                    transaction.payment_method,
                    transaction.status,
                    transaction.patient_name,
                    transaction.user_name,
                    String(transaction.amount),
                ]
                    .join(' ')
                    .toLowerCase()
                    .includes(normalizedSearch);

            const matchesDate = filterDate
                ? transaction.payment_date === filterDate
                : true;

            return matchesSearch && matchesDate;
        });
    }, [transactions, searchQuery, filterDate]);

    const handleFilter = () => {
        setFilterDate(selectedDate);
    };

    const handleDownload = () => {
        const headerRow = tableHeaders
            .map((header) => escapeCsvValue(header.label))
            .join(',');

        const dataRows = filteredTransactions.map((transaction) =>
            tableHeaders
                .map((header) => {
                    const value =
                        header.key === 'amount'
                            ? formatRupiah(transaction.amount)
                            : transaction[header.key];

                    return escapeCsvValue(value);
                })
                .join(','),
        );

        const csvContent = [headerRow, ...dataRows].join('\n');

        const blob = new Blob([csvContent], {
            type: 'text/csv;charset=utf-8;',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `financial-report-${filterDate || 'all-date'}.csv`;
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

        if (key === 'trans_type' || key === 'payment_method') {
            return formatEnumLabel(String(transaction[key]));
        }

        if (key === 'status') {
            const isPaid = String(transaction.status).toLowerCase() === 'paid';

            return (
                <span
                    className={`inline-flex min-w-[70px] justify-center rounded-full px-3 py-1 text-[10px] font-bold ${
                        isPaid
                            ? 'bg-[#D2E3C8] text-[#4F6F52]'
                            : 'bg-[#F3E8C8] text-[#7A5A00]'
                    }`}
                >
                    {formatEnumLabel(transaction.status)}
                </span>
            );
        }

        return transaction[key] || '-';
    };

    return (
        <div className="min-h-screen w-full flex bg-[#FDFEF9] overflow-x-auto">
            <Sidebar />

            <main className="flex-1 flex flex-col min-h-screen min-w-0 bg-[#FDFEF9] pt-[26px] pb-[40px] pl-[28px] pr-[28px]">
                <div className="flex-1 flex flex-col w-full">
                    <div className="w-full flex flex-wrap lg:flex-nowrap items-center py-6 gap-[24px] justify-between">
                        <div className="relative flex-1 min-w-[280px] outline outline-1 outline-gray-300 rounded-lg px-4 py-2 shadow-sm transition-all focus-within:outline-[#739072]">
                            <FontAwesomeIcon
                                icon={faSearch}
                                className="text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 w-4"
                            />

                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) =>
                                    setSearchQuery(event.target.value)
                                }
                                placeholder="Search for an income"
                                className="w-full bg-transparent focus:outline-none pl-8 text-gray-700 placeholder-gray-400"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                router.push('/financial-report/add-invoice')
                            }
                            className="cursor-pointer flex flex-row items-center gap-x-2 rounded-[50px] px-5 py-2 bg-[#86A789] shadow-sm transition-all shrink-0 hover:bg-[#739072]"
                        >
                            <FontAwesomeIcon
                                icon={faPlus}
                                className="text-black w-4"
                            />

                            <span className="font-bold text-black whitespace-nowrap">
                                Add invoice
                            </span>
                        </button>
                    </div>

                    <h2 className="text-[24px] leading-none font-semibold text-[#5F785F]">
                        Financial List
                    </h2>

                    <div className="mt-[18px] w-full flex flex-row flex-wrap gap-x-5 gap-y-4">
                        <div className="min-w-[190px] text-center bg-[#D2E3C8] p-2 rounded-[50px] font-bold text-black whitespace-nowrap">
                            {formattedSelectedDate}
                        </div>

                        <label className="relative min-w-[150px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent overflow-hidden whitespace-nowrap">
                            <span>Select Date</span>

                            <FontAwesomeIcon
                                icon={faCalendarDays}
                                className="text-black ml-[10px] w-4"
                            />

                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(event) =>
                                    setSelectedDate(event.target.value)
                                }
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={handleFilter}
                            className="min-w-[150px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent whitespace-nowrap"
                        >
                            <span>Filter</span>

                            <FontAwesomeIcon
                                icon={faFilter}
                                className="text-black ml-[10px] w-4"
                            />
                        </button>

                        <button
                            type="button"
                            onClick={handleDownload}
                            className="min-w-[150px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent whitespace-nowrap"
                        >
                            <span>Download</span>

                            <FontAwesomeIcon
                                icon={faFileArrowDown}
                                className="text-black ml-[10px] w-4"
                            />
                        </button>
                    </div>

                    {errorMessage && (
                        <p className="mt-4 text-[12px] font-medium text-red-600">
                            {errorMessage}
                        </p>
                    )}

                    <div className="mt-5 w-full overflow-x-auto bg-white">
                        <table className="w-full min-w-[900px] divide-y divide-gray-200 text-[11px]">
                            <thead className="bg-[#D2E3C8] text-gray-700 font-semibold drop-shadow-lg">
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
                                            No financial data found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((transaction) => (
                                        <tr
                                            key={transaction.transaction_id}
                                            className="bg-white text-center text-black border-b border-gray-100"
                                        >
                                            {tableHeaders.map(
                                                (header, index) => (
                                                    <td
                                                        key={header.key}
                                                        className={`px-6 py-4 whitespace-nowrap ${
                                                            index !==
                                                            tableHeaders.length -
                                                                1
                                                                ? 'border-r border-gray-100'
                                                                : ''
                                                        }`}
                                                    >
                                                        {renderTableValue(
                                                            transaction,
                                                            header.key,
                                                        )}
                                                    </td>
                                                ),
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Financial;