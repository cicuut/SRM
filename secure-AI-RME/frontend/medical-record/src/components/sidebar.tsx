'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type Role = 'admin' | 'midwife' | 'asisten' | '';

type NavItem = {
    label: string;
    href: string;
    icon: string;
    roles: Role[];
};

type MeResponse = {
    msg?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role: Role;
        clinic_id?: string | null;
    };
    clinic?: {
        id: string;
        clinic_name: string;
    } | null;
};

const navItems: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: '/dashboard-icon.svg',
        roles: ['admin', 'midwife', 'asisten'],
    },
    {
        label: 'Laporan Harian',
        href: '/daily-report',
        icon: '/visit-icon.svg',
        roles: ['admin', 'midwife', 'asisten'],
    },
    {
        label: 'Rekam Medis',
        href: '/medical-record',
        icon: '/record-icon.svg',
        roles: ['admin', 'midwife', 'asisten'],
    },
    {
        label: 'Laporan Keuangan',
        href: '/financial-report',
        icon: '/financial-icon.svg',
        roles: ['admin', 'midwife'],
    },
    {
        label: 'Pengaturan Manajemen',
        href: '/management-setting',
        icon: '/management-icon.svg',
        roles: ['admin'],
    },
    {
        label: 'Pengaturan Akun',
        href: '/account-setting',
        icon: '/setting-icon.svg',
        roles: ['admin', 'midwife', 'asisten'],
    },
    {
        label: 'Riwayat Aktivitas',
        href: '/activity-history',
        icon: '/activity-icon.svg',
        roles: ['admin'],
    },
];

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();

    const [role, setRole] = useState<Role>('');
    const [fullname, setFullname] = useState('');
    const [clinicName, setClinicName] = useState('');

    useEffect(() => {
        const savedRole = localStorage.getItem('user_role') as Role | null;
        const savedFullname = localStorage.getItem('fullname') || '';

        if (savedRole) {
            setRole(savedRole);
        }

        if (savedFullname) {
            setFullname(savedFullname);
        }

        const fetchCurrentUser = async () => {
            try {
                const token = Cookies.get('access_token');

                if (!token) {
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

                if (!response.ok || !data.user) {
                    return;
                }

                const nextRole = data.user.role || '';

                setRole(nextRole);
                setFullname(data.user.fullname || '');
                setClinicName(data.clinic?.clinic_name || '');

                localStorage.setItem('user_id', data.user.id || '');
                localStorage.setItem('fullname', data.user.fullname || '');
                localStorage.setItem('user_email', data.user.email || '');
                localStorage.setItem('user_role', nextRole || '');
                localStorage.setItem('clinic_id', data.user.clinic_id || '');
            } catch {
                // fallback dari localStorage
            }
        };

        fetchCurrentUser();
    }, []);

    const visibleNavItems = useMemo(() => {
        if (!role) {
            return navItems.filter((item) => item.roles.includes('asisten'));
        }

        return navItems.filter((item) => item.roles.includes(role));
    }, [role]);

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard';
        }

        return pathname === href || pathname.startsWith(`${href}/`);
    };

    const handleLogout = () => {
        Cookies.remove('access_token');

        localStorage.removeItem('user_id');
        localStorage.removeItem('fullname');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('clinic_id');

        router.push('/login');
    };

    return (
        <aside>
            <div className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-white/5 bg-[#FDFEF9] drop-shadow-lg">
                <div className="ml-4 mt-4 flex items-center">
                    <Image
                        src="/IBI-logo.webp"
                        alt="RME Logo"
                        width={80}
                        height={80}
                    />

                    <h1 className="text-3xl">RME</h1>
                </div>

                <div className="mx-6 mt-5 rounded-[18px] bg-[#D2E3C8] px-4 py-3">
                    <p className="truncate text-[13px] font-bold text-[#4F6F52]">
                        {fullname || 'User'}
                    </p>

                    <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-[#5F785F]">
                        {role || 'loading'}
                    </p>

                    {clinicName && (
                        <p className="mt-1 truncate text-[10px] text-[#4F6F52]">
                            {clinicName}
                        </p>
                    )}
                </div>

                <nav className="flex-1 space-y-3 px-6 py-8">
                    {visibleNavItems.map((item) => {
                        const active = isActive(item.href);

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`flex w-full items-center gap-4 rounded-4xl px-5 py-4 transition-all ${
                                    active
                                        ? 'bg-[#739072] text-white'
                                        : 'text-black hover:bg-[#D2E3C8]'
                                }`}
                            >
                                <div className="relative z-10">
                                    <Image
                                        src={item.icon}
                                        alt={item.label}
                                        width={20}
                                        height={20}
                                        className={`h-5 w-5 transition-all ${
                                            active
                                                ? 'brightness-0 invert'
                                                : 'opacity-70'
                                        }`}
                                    />
                                </div>

                                <span className="relative z-10 text-[14px] font-medium">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="px-6 pb-6">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full rounded-4xl border border-[#D2D8CF] px-5 py-3 text-[13px] font-bold text-[#4F6F52] transition-all hover:bg-[#D2E3C8]"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;