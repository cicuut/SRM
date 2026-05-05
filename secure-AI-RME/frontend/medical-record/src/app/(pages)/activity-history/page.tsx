'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '@/components/sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch,
    faFilter,
    faCalendarDays,
    faFileArrowDown,
} from '@fortawesome/free-solid-svg-icons';

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

const tableHeaders = [
    {
        label: 'Audit ID',
        width: 'w-[12%]',
        hasBorder: true,
    },
    {
        label: 'Date & Time',
        width: 'w-[12%]',
        hasBorder: true,
    },
    {
        label: 'User',
        width: 'w-[10%]',
        hasBorder: true,
    },
    {
        label: 'Action',
        width: 'w-[16%]',
        hasBorder: true,
    },
    {
        label: 'Module',
        width: 'w-[14%]',
        hasBorder: true,
    },
    {
        label: 'Record ID',
        width: 'w-[14%]',
        hasBorder: true,
    },
    {
        label: 'Old Value (Before)',
        width: 'w-[11%]',
        hasBorder: true,
    },
    {
        label: 'New Value (After)',
        width: 'w-[11%]',
        hasBorder: false,
    },
];

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const ActivityHistory = () => {
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState('2026-01-28');
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);

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

    const checkAdminAccess = async () => {
        try {
            setIsCheckingAccess(true);

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
                router.push('/dashboard');
                return;
            }

            if (data.user.role !== 'admin') {
                router.push('/dashboard');
                return;
            }

            localStorage.setItem('user_id', data.user.id || '');
            localStorage.setItem('fullname', data.user.fullname || '');
            localStorage.setItem('user_email', data.user.email || '');
            localStorage.setItem('user_role', data.user.role || '');
            localStorage.setItem('clinic_id', data.user.clinic_id || '');

            setHasAccess(true);
        } catch {
            router.push('/dashboard');
        } finally {
            setIsCheckingAccess(false);
        }
    };

    useEffect(() => {
        checkAdminAccess();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isCheckingAccess) {
        return (
            <div className="min-h-screen flex bg-[#FDFEF9] overflow-x-hidden">
                <Sidebar />

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
            <Sidebar />

            <div className="flex-1 flex flex-col ml-0 pt-[26px] pb-[40px] pl-[28px] pr-[28px] min-w-0 overflow-x-hidden">
                <div className="flex-1 flex flex-col w-full max-w-[1180px]">
                    <div className="w-full flex items-center py-8 gap-[24px]">
                        <div className="relative flex-1 outline outline-1 outline-gray-300 rounded-lg px-4 py-2 shadow-sm transition-all focus-within:outline-[#739072]">
                            <FontAwesomeIcon
                                icon={faSearch}
                                className="text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 w-4"
                            />

                            <input
                                type="text"
                                placeholder="Cari Data Riwayat Aktivitas"
                                className="w-full bg-transparent focus:outline-none pl-8 text-gray-700 placeholder-gray-400"
                            />
                        </div>
                    </div>

                    <h2 className="text-[24px] leading-none font-semibold text-[#5F785F]">
                        Audit Log
                    </h2>

                    <div className="mt-[18px] w-full flex flex-row gap-x-5 gap-y-4 flex-wrap">
                        <div className="min-w-[150px] text-center bg-[#D2E3C8] p-2 rounded-[50px] font-bold text-black">
                            {formatDisplayDate(selectedDate)}
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
                                onChange={(e) =>
                                    setSelectedDate(e.target.value)
                                }
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </label>

                        <button
                            type="button"
                            className="min-w-[120px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent"
                        >
                            <span>Filter</span>
                            <FontAwesomeIcon
                                icon={faFilter}
                                className="text-black ml-[10px] w-4"
                            />
                        </button>

                        <button
                            type="button"
                            className="min-w-[150px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent"
                        >
                            <span>Download</span>
                            <FontAwesomeIcon
                                icon={faFileArrowDown}
                                className="text-black ml-[10px] w-4"
                            />
                        </button>
                    </div>

                    <div className="mt-5 w-full overflow-x-auto bg-white">
                        <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                            <thead className="bg-[#D2E3C8] text-gray-700 font-semibold drop-shadow-lg">
                                <tr>
                                    {tableHeaders.map((header) => (
                                        <th
                                            key={header.label}
                                            className={`px-6 py-4 border-r border-gray-200 text-center whitespace-nowrap ${header.width} ${
                                                !header.hasBorder
                                                    ? 'border-r-0'
                                                    : ''
                                            }`}
                                        >
                                            {header.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivityHistory;