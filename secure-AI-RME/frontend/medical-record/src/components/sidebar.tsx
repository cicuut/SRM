    'use client';
    import React from "react";
    import { useState } from "react";
    import Image from "next/image";
    import Link from "next/link";
    import { usePathname } from "next/navigation";
    import { House, UsersRound, HeartPulse, Wallet, UserCog, Settings, History    } from 'lucide-react';

    const Sidebar = () => {
        const pathname = usePathname();
        const navItems = [
            { label: "Dashboard", href: '/dashboard', icon: House },
            { label: "Laporan Harian", href: '/daily-report', icon: UsersRound },
            { label: "Rekam Medis", href: '/medical-record', icon: HeartPulse },
            { label: "Laporan Keuangan", href: '/financial', icon: Wallet },
            { label: "Pengaturan Manajemen", href: '/management-setting', icon: UserCog },
            { label: "Pengaturan Akun", href: '/account-setting', icon: Settings },
            { label: "Riwayat Aktivitas", href: '/activity-history', icon: History },
        ];
        const isActive = (href: string) => {
            if (href === "/daily-report") {
                return pathname === "/daily-report";
            }
            if (href === "/medical-record") {
                return pathname === "/medical-record";
            }
            if (href === "/financial") {
                return pathname === "/financial";
            }
            if (href === "/management-setting") {
                return pathname === "/management-setting";
            }
            if (href === "/account-setting") {
                return pathname === "/account-setting";
            }
            if (href === "/activity-history") {
                return pathname === "/activity-history";
            }
            return pathname.startsWith(href);
        };


        return (
            <aside>
                {/* logo dan nama */}
                <div className="w-64 bg-[#FDFEF9] border-r border-white/5 flex flex-col h-screen  top-0 left-0 fixed drop-shadow-lg">
                    <div className="flex items-center mt-4 ml-4">
                        <Image src="/IBI-logo.webp" alt="icon" width={80} height={80} />
                        <h1 className=" text-3xl">RME</h1>
                    </div>


                    {/* navigation items */}
                    <nav className="flex-1 px-6 space-y-3 py-10 ">
                        {navItems.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={`
                                        w-full flex items-center gap-4 px-5 py-4 rounded-4xl group
                                        ${active
                                            ? "bg-[#739072] text-white"
                                            : "text-black"
                                        }`}
                                >
                                      <item.icon 
                                        size={20} 
                                        className={`${active ? "text-white" : "text-black"} transition-colors`}/>
                                       <span className="text-[14px] font-medium relative z-10">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </aside>
        )

    }
    export default Sidebar;
