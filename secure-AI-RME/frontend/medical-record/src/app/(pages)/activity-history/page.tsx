'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch,
    faFilter,
    faCalendarDays,
    faFileArrowDown,
} from '@fortawesome/free-solid-svg-icons';
import LoadingOverlay from "@/components/loading"

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type MeResponse = {
    msg?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role: string;
        clinic_id?: string | null;
    };
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
    width: string;
    hasBorder: boolean;
};

const tableHeaders: TableHeader[] = [
    {
        label: 'Audit ID',
        key: 'audit_number',
        width: 'w-[12%]',
        hasBorder: true,
    },
    {
        label: 'Date & Time',
        key: 'date_time',
        width: 'w-[12%]',
        hasBorder: true,
    },
    {
        label: 'User',
        key: 'user',
        width: 'w-[10%]',
        hasBorder: true,
    },
    {
        label: 'Action',
        key: 'action',
        width: 'w-[16%]',
        hasBorder: true,
    },
    {
        label: 'Module',
        key: 'module',
        width: 'w-[14%]',
        hasBorder: true,
    },
    {
        label: 'Record ID',
        key: 'record_id',
        width: 'w-[14%]',
        hasBorder: true,
    },
    {
        label: 'Old Value (Before)',
        key: 'old_value',
        width: 'w-[11%]',
        hasBorder: true,
    },
    {
        label: 'New Value (After)',
        key: 'new_value',
        width: 'w-[11%]',
        hasBorder: false,
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

const escapeCsvValue = (value: string | number | null | undefined) => {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
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

const truncateValue = (value: string, maxLength = 80) => {
    if (!value) return '-';

    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength)}...`;
};

const ActivityHistory = () => {
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [actionOptions, setActionOptions] = useState<string[]>([]);

    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const formattedSelectedDate = useMemo(() => {
        return formatDisplayDate(selectedDate);
    }, [selectedDate]);

    const activeFilterCount = useMemo(() => {
        return actionFilter !== 'all' ? 1 : 0;
    }, [actionFilter]);

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
        router.push('/dashboard');
    };

    const checkAdminAccess = async () => {
        try {
            setIsCheckingAccess(true);
            setErrorMessage('');

            const token = Cookies.get('access_token');

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
                handleForbidden();
                return;
            }

            if (data.user.role !== 'admin') {
                handleForbidden();
                return;
            }

            localStorage.setItem('user_id', data.user.id || '');
            localStorage.setItem('fullname', data.user.fullname || '');
            localStorage.setItem('user_email', data.user.email || '');
            localStorage.setItem('user_role', data.user.role || '');
            localStorage.setItem('clinic_id', data.user.clinic_id || '');

            setHasAccess(true);
        } catch {
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

            const response = await fetch(
                `${API_BASE_URL}/activity-history/actions`,
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

            if (response.ok && Array.isArray(data)) {
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

            const response = await fetch(
                `${API_BASE_URL}/activity-history/get-all${queryString ? `?${queryString}` : ''
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
                throw new Error(data?.msg || 'Gagal mengambil activity history');
            }

            setAuditLogs(Array.isArray(data) ? data : []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil activity history';

            setErrorMessage(message);
            setAuditLogs([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkAdminAccess();
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

    const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        fetchAuditLogs();
    };

    const handleReset = () => {
        setSelectedDate(getTodayInputValue());
        setSearchQuery('');
        setActionFilter('all');
        setIsFilterOpen(false);
    };

    const handleShowAllDates = () => {
        setSelectedDate('');
    };

    const handleClearFilter = () => {
        setActionFilter('all');
    };

    const handleDownload = () => {
        const headerRow = tableHeaders
            .map((header) => escapeCsvValue(header.label))
            .join(',');

        const dataRows = auditLogs.map((log) =>
            tableHeaders
                .map((header) => {
                    const value =
                        header.key === 'date_time'
                            ? formatDateTime(log.date_time)
                            : log[header.key];

                    return escapeCsvValue(value);
                })
                .join(','),
        );

        const csvContent = [headerRow, ...dataRows].join('\n');

        const blob = new Blob([`\uFEFF${csvContent}`], {
            type: 'text/csv;charset=utf-8;',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `activity-history-${selectedDate || 'all-dates'}.csv`;
        link.click();

        URL.revokeObjectURL(url);
    };

    if (isCheckingAccess) {
        return (
            <div className="min-h-screen flex bg-[#FDFEF9] overflow-x-hidden">
                {isLoading && <LoadingOverlay />}

                <div className="flex-1 flex flex-col ml-0 pt-[26px] pb-[40px] pl-[28px] pr-[28px] min-w-0 overflow-x-hidden">
                    <div className="flex-1 flex flex-col w-full max-w-[1180px] items-center justify-center">
                        <p className="text-[14px] font-bold text-[#5F785F]">
                            Checking activity access...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!hasAccess) {
        return null;
    }

    return (
        <div className="min-h-screen flex bg-[#FDFEF9] overflow-x-hidden">
            
            <div className="flex-1 flex flex-col ml-0 pt-[26px] pb-[40px] pl-[28px] pr-[28px] min-w-0 overflow-x-hidden">
                <div className="flex-1 flex flex-col w-full max-w-[1180px]">
                    <div className="w-full flex items-center py-8 gap-[24px]">
                        <form
                            onSubmit={handleSearchSubmit}
                            className="relative flex-1 outline outline-1 outline-gray-300 rounded-lg px-4 py-2 shadow-sm transition-all focus-within:outline-[#739072]"
                        >
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
                                placeholder="Cari Data Riwayat Aktivitas"
                                className="w-full bg-transparent focus:outline-none pl-8 text-gray-700 placeholder-gray-400"
                            />
                        </form>
                    </div>

                    <h2 className="text-[24px] leading-none font-semibold text-[#5F785F]">
                        Audit Log
                    </h2>

                    <div className="mt-[18px] w-full flex flex-row gap-x-5 gap-y-4 flex-wrap">
                        <div className="min-w-[150px] text-center bg-[#D2E3C8] p-2 rounded-[50px] font-bold text-black">
                            {formattedSelectedDate}
                        </div>

                        <label className="relative min-w-[150px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent overflow-hidden">
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
                            onClick={() =>
                                setIsFilterOpen((current) => !current)
                            }
                            className={`min-w-[120px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent ${activeFilterCount > 0
                                ? 'bg-[#EEF3E9] border-[#739072]'
                                : ''
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
                                className="text-black ml-[10px] w-4"
                            />
                        </button>

                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={isLoading || auditLogs.length === 0}
                            className="min-w-[150px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span>Download</span>
                            <FontAwesomeIcon
                                icon={faFileArrowDown}
                                className="text-black ml-[10px] w-4"
                            />
                        </button>

                        <button
                            type="button"
                            onClick={handleReset}
                            className="min-w-[150px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent"
                        >
                            Reset Today
                        </button>

                        <button
                            type="button"
                            onClick={handleShowAllDates}
                            className="min-w-[150px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent"
                        >
                            All Dates
                        </button>
                    </div>

                    {isFilterOpen && (
                        <div className="mt-[14px] w-full rounded-lg border border-gray-200 bg-white p-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
                                <label className="block">
                                    <span className="text-[11px] font-bold text-black">
                                        Action
                                    </span>

                                    <select
                                        value={actionFilter}
                                        onChange={(event) =>
                                            setActionFilter(event.target.value)
                                        }
                                        className="mt-[8px] h-[34px] w-full rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                    >
                                        <option value="all">All Action</option>

                                        {actionOptions.map((action) => (
                                            <option key={action} value={action}>
                                                {action}
                                            </option>
                                        ))}
                                    </select>
                                </label>

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
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
                            {errorMessage}
                        </div>
                    )}

                    <div className="mt-5 w-full overflow-x-auto bg-white">
                        <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                            <thead className="bg-[#D2E3C8] text-gray-700 font-semibold drop-shadow-lg">
                                <tr>
                                    {tableHeaders.map((header) => (
                                        <th
                                            key={header.label}
                                            className={`px-6 py-4 border-r border-gray-200 text-center whitespace-nowrap ${header.width} ${!header.hasBorder
                                                ? 'border-r-0'
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
                                            Loading activity data...
                                        </td>
                                    </tr>
                                ) : auditLogs.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={tableHeaders.length}
                                            className="px-6 py-8 text-center text-gray-500"
                                        >
                                            Tidak ada data activity history
                                        </td>
                                    </tr>
                                ) : (
                                    auditLogs.map((log) => (
                                        <tr
                                            key={log.audit_id}
                                            className="border-b border-gray-100 text-center text-black hover:bg-[#F8FAF6]"
                                        >
                                            {tableHeaders.map((header) => {
                                                const rawValue =
                                                    header.key === 'date_time'
                                                        ? formatDateTime(
                                                            log.date_time,
                                                        )
                                                        : log[header.key];

                                                return (
                                                    <td
                                                        key={header.key}
                                                        className={`px-6 py-4 ${header.hasBorder
                                                            ? 'border-r border-gray-100'
                                                            : ''
                                                            }`}
                                                        title={rawValue || '-'}
                                                    >
                                                        <div className="truncate">
                                                            {header.key ===
                                                                'old_value' ||
                                                                header.key ===
                                                                'new_value'
                                                                ? truncateValue(
                                                                    rawValue,
                                                                    70,
                                                                )
                                                                : rawValue ||
                                                                '-'}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <p className="mt-[14px] text-[11px] text-[#5F5F5F]">
                        Showing{' '}
                        <span className="font-bold text-black">
                            {auditLogs.length}
                        </span>{' '}
                        activity log(s)
                        {selectedDate
                            ? ` on ${formattedSelectedDate}`
                            : ' for all dates'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ActivityHistory;