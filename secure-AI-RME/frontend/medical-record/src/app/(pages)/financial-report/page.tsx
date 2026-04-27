'use client';

import { useState } from 'react';
import Sidebar from '@/components/sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch,
    faFilter,
    faPlus,
    faCalendarDays,
    faFileArrowDown,
} from '@fortawesome/free-solid-svg-icons';

const Financial = () => {
    const [selectedDate, setSelectedDate] = useState('2026-01-28');

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

    return (
        <div className="min-h-screen flex bg-[#FDFEF9] overflow-x-hidden">
            <Sidebar />

            <div className="flex-1 flex flex-col ml-0 pt-[26px] pb-[40px] pl-[28px] pr-[28px] min-w-0 overflow-x-hidden">
                <div className="flex-1 flex flex-col w-full max-w-[1180px]">
                    <div className="w-full flex items-center py-6 gap-[24px] justify-between">
                        <div className="relative flex-1 outline outline-1 outline-gray-300 rounded-lg px-4 py-2 shadow-sm transition-all focus-within:outline-[#739072]">
                            <FontAwesomeIcon
                                icon={faSearch}
                                className="text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 w-4"
                            />

                            <input
                                type="text"
                                placeholder="Cari Data Laporan Keuangan"
                                className="w-full bg-transparent focus:outline-none pl-8 text-gray-700 placeholder-gray-400"
                            />
                        </div>

                        <button
                            type="button"
                            className="cursor-pointer flex flex-row items-center gap-x-2 rounded-[50px] px-5 py-2 bg-[#86A789] shadow-sm transition-all shrink-0"
                        >
                            <FontAwesomeIcon
                                icon={faPlus}
                                className="text-black w-4"
                            />
                            <span className="font-bold text-black">
                                Tambah Invoice
                            </span>
                        </button>
                    </div>

                    <h2 className="text-[32px] leading-none font-semibold text-[#5F785F]">
                        Financial List
                    </h2>

                    <div className="mt-[18px] w-full flex flex-row gap-x-5">
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
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </label>

                        <button
                            type="button"
                            className="min-w-[150px] text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer text-[#4B4B4B] bg-transparent"
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

                    <div className="mt-5 w-full overflow-hidden bg-white">
                        <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                            <thead className="bg-[#D2E3C8] text-gray-700 font-semibold drop-shadow-lg">
                                <tr>
                                    <th className="px-6 py-4 border-r border-gray-200 w-[14%]">
                                        Invoice No
                                    </th>
                                    <th className="px-6 py-4 border-r border-gray-200 w-[14%]">
                                        Trans ID
                                    </th>
                                    <th className="px-6 py-4 border-r border-gray-200 w-[12%]">
                                        Type
                                    </th>
                                    <th className="px-6 py-4 border-r border-gray-200 w-[18%]">
                                        Visit_ID
                                    </th>
                                    <th className="px-6 py-4 border-r border-gray-200 w-[14%]">
                                        Method
                                    </th>
                                    <th className="px-6 py-4 border-r border-gray-200 w-[16%]">
                                        Total Amount
                                    </th>
                                    <th className="px-6 py-4 w-[12%]">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Financial;