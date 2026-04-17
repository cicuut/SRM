'use client';
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Cookies from "js-cookie";
import api from "@/utils/app";

interface CurrentUser {
    fullname: string;
    role: string;
}

function formatDisplayRole(role: string): string {
    if (!role.trim()) return "";
    return role
        .split(/[\s_-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
}

const Dashboard = () => {
    const [dateLabel, setDateLabel] = useState<string>("");
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

    const dateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
            }),
        []
    );

    useEffect(() => {
        setDateLabel(dateFormatter.format(new Date()));
    }, [dateFormatter]);

    useEffect(() => {
        let cancelled = false;
        const token = Cookies.get("access_token");
        if (!token) return;

        (async () => {
            try {
                const { data } = await api.get<{ user: CurrentUser }>("/auth/me", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!cancelled) setCurrentUser(data.user);
            } catch (err) {
                console.error("Failed to load current user:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const displayName = currentUser?.fullname?.trim() || "";
    const displayRole = currentUser?.role ? formatDisplayRole(currentUser.role) : "";

    return (
        <div>
            <div className="flex-1 flex flex-col  w-full ">
                <div className="ml-5 mt-5 flex flex-col gap-y-[25px]">
                    <div className="flex gap-x-[20px] w-full">
                        <div className="flex  flex-row bg-[#739072] text-white py-5 px-8 pb-[0] rounded-[30px] flex-1 gap-x-[30]">
                            <div className="flex flex-col flex-1 gap-y-[10] w-sm">
                                <h1 className="text-[25px] font-bold">
                                    {displayName ? `Hi, ${displayName}!` : "Hi!"}
                                </h1>
                                <p className="text-[20px]">Welcome Back! It’s a good time to manage your databases. </p>
                                <p className="text-[20px]">{dateLabel || "\u00A0"}</p>
                            </div>
                            <div className="illustration">
                                <Image src="/doctor-icon.png" alt="img" width={160} height={160} />
                            </div>
                        </div>
                        <div className="bg-[#739072] text-[15px] text-white py-5 px-8 pb-[0] rounded-[30px] w-md flex flex-col items-center gap-y-[5px]">
                            <Image src="/user.png" alt="img" width={80} height={80} className="rounded-[50px]" />
                            <p>{displayName || "\u00A0"}</p>
                            <p>{displayRole || "\u00A0"}</p>
                        </div>
                    </div>
                    <div className="flex gap-x-[40px]">
                        <div className="bg-[#FFFFFF] drop-shadow-lg py-6 px-7 rounded-[10px] text-center flex-1">
                            <h3 className="text-[20px]">Visit Total Montly</h3>
                            <p className="font-bold text-[20px]">300 visits</p>
                        </div>
                        <div className=" bg-[#FFFFFF] drop-shadow-lg py-6 px-7 rounded-[10px] text-center flex-1">
                            <h3 className="text-[20px]">Income Monthly</h3>
                            <p className="font-bold text-[20px]">Rp. 500.000</p>
                        </div>
                        <div className=" bg-[#FFFFFF] drop-shadow-lg py-6 px-7 rounded-[10px] text-center flex-1">
                            <h3 className="text-[20px]">Outcome Monthly</h3>
                            <p className="font-bold text-[20px]">Rp. 100.000</p>
                        </div>
                    </div>
                    <div className="flex flex-row gap-6 mt-6 w-full">
                        <div className="flex-[1.5] flex flex-col gap-y-[40px]">
                            <div className="bg-[#FFFFFF] drop-shadow-lg h-130 rounded-[10px] text-center px-5 py-6">
                                <h1 className="text-xl">Visit Total Graphic</h1>
                            </div>
                            <div className="bg-[#FFFFFF] drop-shadow-lg h-130 rounded-[10px] text-center px-5 py-6">
                                <h1 className="text-xl">Financial Graphic</h1>
                            </div>
                        </div>
                        <div className="flex-[1] flex flex-col gap-y-[40px]">
                            <div className="h-80 bg-[#FFFFFF] drop-shadow-lg rounded-[10px] text-center px-5 py-6">
                                <h1 className="text-xl">Visit Forecast</h1></div>
                            <div className="flex-1 bg-[#FFFFFF] drop-shadow-lg rounded-[10px] text-center px-5 py-6">
                                <h1 className="text-xl">Top 5 diagnosis of the month</h1>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

}
export default Dashboard;
