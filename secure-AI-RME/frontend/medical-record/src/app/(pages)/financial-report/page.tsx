'use client';
import React from "react";
import { useState } from "react";
import { emit } from "process";
import Sidebar from "@/components/sidebar";

const Financial = () => {
    const [selectedDate, setSelectedDate] = useState("2026-01-28");

    const formatDisplayDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    };

    return (
        <div className="min-h-screen flex bg-[#FDFEF9] overflow-x-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col ml-0 pt-[26px] pb-[40px] pl-[28px] pr-[28px] min-w-0 overflow-x-hidden">
                <div className="mt-[54px] flex items-center gap-[20px] w-full max-w-[1180px]">
                    <input
                        type="text"
                        placeholder="Search for an income"
                        className="flex-1 min-w-0 h-[54px] rounded-[12px] border border-[#D9D9D9] bg-transparent px-[22px] text-[18px] text-[#222222] outline-none placeholder:text-[#BDBDBD]"
                    />

                    <button className="w-[176px] h-[54px] rounded-full bg-[#95A98B] text-[18px] font-medium text-black shrink-0">
                        + Add invoice
                    </button>
                </div>

                <h2 className="mt-[26px] text-[32px] leading-none font-semibold text-[#5F785F]">
                    Financial List
                </h2>

                <div className="mt-[28px] flex items-center gap-[18px] w-full max-w-[1180px]">
                    <button className="h-[48px] px-[22px] rounded-full bg-[#DCE8D0] text-[17px] font-medium text-black whitespace-nowrap shrink-0">
                        {formatDisplayDate(selectedDate)}
                    </button>

                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="h-[48px] w-[172px] px-[20px] rounded-full border border-black text-[17px] font-medium text-[#4B4B4B] whitespace-nowrap bg-transparent outline-none shrink-0"
                    />

                    <button className="h-[48px] w-[128px] rounded-full border border-black text-[17px] font-medium text-[#4B4B4B] whitespace-nowrap shrink-0">
                        Filter
                    </button>

                    <button className="h-[48px] w-[168px] rounded-full border border-black text-[17px] font-medium text-[#4B4B4B] whitespace-nowrap shrink-0">
                        Download
                    </button>
                </div>

                <div className="mt-[28px] w-full max-w-[1180px] overflow-hidden bg-white">
                    <table className="w-full table-fixed border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-[#EEF3E9] text-left">
                                <th className="h-[56px] px-[18px] text-[14px] font-semibold text-black border-r border-[#D7DDD2] w-[16%]">
                                    Transaction No
                                </th>
                                <th className="h-[56px] px-[18px] text-[14px] font-semibold text-black border-r border-[#D7DDD2] w-[13%]">
                                    Date
                                </th>
                                <th className="h-[56px] px-[18px] text-[14px] font-semibold text-black border-r border-[#D7DDD2] w-[12%]">
                                    Type
                                </th>
                                <th className="h-[56px] px-[18px] text-[14px] font-semibold text-black border-r border-[#D7DDD2] w-[19%]">
                                    Visit_ID
                                </th>
                                <th className="h-[56px] px-[18px] text-[14px] font-semibold text-black border-r border-[#D7DDD2] w-[14%]">
                                    Method
                                </th>
                                <th className="h-[56px] px-[18px] text-[14px] font-semibold text-black border-r border-[#D7DDD2] w-[14%]">
                                    Total Amount
                                </th>
                                <th className="h-[56px] px-[18px] text-[14px] font-semibold text-black w-[12%]">
                                    Status
                                </th>
                            </tr>
                        </thead>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default Financial;