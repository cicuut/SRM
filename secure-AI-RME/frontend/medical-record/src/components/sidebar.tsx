'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import Cookies from 'js-cookie';
import {
    HeartPulse,
    History,
    House,
    Settings,
    UserCog,
    UsersRound,
    Wallet,
} from 'lucide-react';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type Role = 'admin' | 'midwife' | 'asisten' | '';

type NavItem = {
    label: string;
    href: string;
    icon: ElementType;
    roles: Role[];
};

type MeResponse = {
    msg?: string;
    requires_clinic_setup?: boolean;
    redirect_path?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role?: string;
        user_role?: string;
        clinic_id?: string | null;
        is_active?: boolean;
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
        icon: House,
        roles: ['admin', 'midwife', 'asisten'],
    },
    {
        label: 'Laporan Harian',
        href: '/daily-report',
        icon: UsersRound,
        roles: ['admin', 'midwife', 'asisten'],
    },
    {
        label: 'Rekam Medis',
        href: '/medical-record',
        icon: HeartPulse,
        roles: ['admin', 'midwife', 'asisten'],
    },
    {
        label: 'Laporan Keuangan',
        href: '/financial-report',
        icon: Wallet,
        roles: ['admin', 'midwife'],
    },
    {
        label: 'Kelola Manajemen',
        href: '/management-setting',
        icon: UserCog,
        roles: ['admin', 'midwife'],
    },
    {
        label: 'Pengaturan Akun',
        href: '/account-setting',
        icon: Settings,
        roles: ['admin', 'midwife', 'asisten'],
    },
    {
        label: 'Riwayat Aktivitas',
        href: '/activity-history',
        icon: History,
        roles: ['admin', 'midwife'],
    },
];

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const normalizeRole = (value?: string | null): Role => {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'admin') return 'admin';
    if (normalized === 'developer') return 'admin';

    if (normalized === 'midwife') return 'midwife';
    if (normalized === 'bidan') return 'midwife';
    if (normalized === 'owner') return 'midwife';

    if (normalized === 'asisten') return 'asisten';
    if (normalized === 'assistant') return 'asisten';
    if (normalized === 'staff') return 'asisten';

    return '';
};

const clearSession = () => {
    Cookies.remove('access_token', { path: '/' });

    if (typeof window === 'undefined') return;

    localStorage.removeItem('user_id');
    localStorage.removeItem('temp_user_id');
    localStorage.removeItem('fullname');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    localStorage.removeItem('clinic_id');
    localStorage.removeItem('profile_photo');
    localStorage.removeItem('requires_clinic_setup');
};

const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();

    const [role, setRole] = useState<Role>('');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const savedRole = normalizeRole(localStorage.getItem('user_role'));

        if (savedRole) {
            setRole(savedRole);
        }

        setIsReady(true);

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

                if (response.status === 401 || response.status === 422) {
                    clearSession();
                    router.push('/login');
                    return;
                }

                if (!response.ok || !data.user) {
                    return;
                }

                const nextRole = normalizeRole(
                    data.user.role || data.user.user_role,
                );

                setRole(nextRole);

                localStorage.setItem('user_id', data.user.id || '');
                localStorage.setItem('temp_user_id', data.user.id || '');
                localStorage.setItem('fullname', data.user.fullname || '');
                localStorage.setItem('user_email', data.user.email || '');
                localStorage.setItem('user_role', nextRole || '');
                localStorage.setItem('clinic_id', data.user.clinic_id || '');
                localStorage.setItem(
                    'requires_clinic_setup',
                    data.requires_clinic_setup ? 'true' : 'false',
                );

                if (
                    nextRole === 'midwife' &&
                    data.requires_clinic_setup &&
                    pathname !== '/register-clinic'
                ) {
                    router.push(data.redirect_path || '/register-clinic');
                }
            } catch {
                // Tetap gunakan data dari localStorage jika server belum merespons.
            }
        };

        fetchCurrentUser();
    }, [pathname, router]);

    const visibleNavItems = useMemo(() => {
        if (!isReady) {
            return [];
        }

        if (!role) {
            return navItems.filter((item) => item.roles.includes('asisten'));
        }

        return navItems.filter((item) => item.roles.includes(role));
    }, [isReady, role]);

    const isActive = (href: string) => {
        if (href === '/dashboard') {
            return pathname === '/dashboard';
        }

        return pathname === href || pathname.startsWith(`${href}/`);
    };

    const handleLogout = () => {
        clearSession();
        router.push('/login');
    };

    return (
        <aside>
            <div className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-white/5 bg-[#FDFEF9] drop-shadow-lg">
                <div className="ml-4 mt-4 flex w-full items-center">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={70}
                        height={70}
                        priority
                    />

                    <div className="flex select-none flex-col leading-tight">
                        <span className="text-[20px] font-bold text-black">
                            System
                        </span>

                        <span className="text-[20px] font-bold text-black">
                            Management
                        </span>
                    </div>
                </div>

                <nav className="mt-8 flex-1 space-y-3 px-6 py-4">
                    {visibleNavItems.map((item) => {
                        const active = isActive(item.href);
                        const Icon = item.icon;

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
                                <Icon
                                    size={20}
                                    className={`transition-colors ${
                                        active ? 'text-white' : 'text-black'
                                    }`}
                                />

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