    'use client';
    import React from "react";
    import { useState } from "react";
    import Image from "next/image";
    import Link from "next/link";
    import { usePathname } from "next/navigation";

    const Sidebar = () => {
        const pathname = usePathname();
        const navItems = [
            { label: "Dashboard", href: '/dashboard', icon: '/dashboard-icon.svg' },
            { label: "Laporan Harian", href: '/daily-report', icon: '/visit-icon.svg' },
            { label: "Rekam Medis", href: '/medical-record', icon: '/record-icon.svg' },
            { label: "Laporan Keuangan", href: '/financial-report', icon: '/financial-icon.svg' },
            { label: "Pengaturan Manajemen", href: '/management-setting', icon: '/management-icon.svg' },
            { label: "Pengaturan Akun", href: '/account-setting', icon: '/setting-icon.svg' },
            { label: "Riwayat Aktivitas", href: '/activity-history', icon: '/activity-icon.svg' },
        ];
        const isActive = (href: string) => {
            if (href === "/daily-report") {
                return pathname === "/daily-report";
            }
            if (href === "/medical-record") {
                return pathname === "/medical-record";
            }
            if (href === "/financial-report") {
                return pathname === "/financial-report";
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
                    w-full flex items-center gap-4 px-5 py-4 rounded-4xl 
                    ${active
                                            ? "bg-[#739072] text-white"
                                            : "text-black"
                                        }
                `}
                                >
                                    <div className="relative z-10">
                                        <Image
                                            src={item.icon}
                                            alt={item.label}
                                            width={20}
                                            height={20}
                                            className={`w-5 h-5 transition-all ${active
                                                ? "brightness-0 invert"
                                                : "opacity-70"
                                                }`}
                                        />
                                    </div>
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
