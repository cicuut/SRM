'use client';
import React from "react";
import { useState } from "react";
import { emit } from "process";
import Sidebar from "@/components/sidebar";
import Image from "next/image";
const Dashboard = () => {


    return (
        <div className="min-h-screen flex bg-[#FDFEF9]">
            <Sidebar />
            <div className="flex-1 flex flex-col ml-70 py-10 max-w-[1200px] mx-auto w-full">
                <h1 className="text-[#4F6F52] underline font-bold text-2xl">Dashboard</h1>
                <div className="ml-[50] mr-[50] mt-5 flex flex-col gap-y-[25px] ">
                    <div className="flex gap-x-[20px]">
                        <div className="flex flex-row bg-[#739072] text-white py-5 px-8 pb-[0] rounded-[30px] w-2xl gap-x-[30]">
                            <div className="flex flex-col gap-y-[10] w-sm">
                                <h1 className="text-[25px] font-bold">Hi, Cica!</h1>
                                <p className="text-[15px]">Welcome Back! It’s a good time to manage your databases. </p>
                                <p className="text-[15px]">Wed, 28 January 2026</p>
                            </div>
                            <div className="illustration">
                                <Image src="/doctor-icon.png" alt="img" width={160} height={160} />
                            </div>
                        </div>
                        <div className="bg-[#739072] text-[15px] text-white py-5 px-8 pb-[0] rounded-[30px] w-md flex flex-col items-center gap-y-[5px]">
                            <Image src="/jennie.jpg" alt="img" width={80} height={80} className="rounded-[50px]" />
                            <p>Cica</p>
                            <p>Midwife</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-x-[50px]">
                        <div className="visit-stat bg-[#FFFFFF] drop-shadow-lg py-6 px-7 rounded-[10px] text-center">
                            <h3 className="text-[20px]">Visit Total Montly</h3>
                            <p className="font-bold text-[20px]">300 visits</p>
                        </div>
                        <div className="visit-stat bg-[#FFFFFF] drop-shadow-lg py-6 px-7 rounded-[10px] text-center">
                            <h3 className="text-[20px]">Income Monthly</h3>
                            <p className="font-bold text-[20px]">Rp. 500.000</p>
                        </div>
                        <div className="visit-stat bg-[#FFFFFF] drop-shadow-lg py-6 px-7 rounded-[10px] text-center">
                            <h3 className="text-[20px]">Outcome Monthly</h3>
                            <p className="font-bold text-[20px]">Rp. 100.000</p>
                        </div>
                    </div>
                    <div className="flex flex-row gap-6 mt-6">
                        <div className="flex-[1.5] flex flex-col gap-y-[40px]">
                            <div className="bg-[#FFFFFF] drop-shadow-lg h-80 rounded-[10px] text-center px-5 py-6">
                                <h1 className="text-xl">Visit Total Graphic</h1>
                            </div>
                            <div className="bg-[#FFFFFF] drop-shadow-lg h-80 rounded-[10px] text-center px-5 py-6">
                                <h1 className="text-xl">Financial Graphic</h1>
                            </div>
                        </div>
                        <div className="flex-[1] flex flex-col gap-y-[40px]">
                        <div className="h-40 bg-[#FFFFFF] drop-shadow-lg rounded-[10px] text-center px-5 py-6">
                            <h1 className="text-xl">Visit Forecast</h1></div>
                        <div className="flex-2 bg-[#FFFFFF] drop-shadow-lg rounded-[10px] text-center px-5 py-6">
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
