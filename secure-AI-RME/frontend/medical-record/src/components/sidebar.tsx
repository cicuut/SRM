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
        profile_photo?: string | null;
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

const formatRole = (role: Role) => {
    if (role === 'admin') return 'Admin';
    if (role === 'midwife') return 'Bidan';
    if (role === 'asisten') return 'Asisten';

    return 'Memuat';
};

const getInitials = (name: string) => {
    const initials = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return initials || 'U';
};

const LogoutIcon = () => {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M10 6H6.5C5.67 6 5 6.67 5 7.5V16.5C5 17.33 5.67 18 6.5 18H10"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M15 8L19 12L15 16"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M19 12H10"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();

    const [role, setRole] = useState<Role>('');
    const [fullname, setFullname] = useState('');
    const [profilePhoto, setProfilePhoto] = useState('');

    const initials = getInitials(fullname || 'User');

    useEffect(() => {
        const savedRole = localStorage.getItem('user_role') as Role | null;
        const savedFullname = localStorage.getItem('fullname') || '';
        const savedPhoto = localStorage.getItem('profile_photo') || '';

        if (savedRole) {
            setRole(savedRole);
        }

        if (savedFullname) {
            setFullname(savedFullname);
        }

        if (savedPhoto) {
            setProfilePhoto(savedPhoto);
        }

        const fetchCurrentUser = async () => {
            try {
                const token = Cookies.get('access_token');

                if (!token) return;

                const response = await fetch(`${API_BASE_URL}/auth/me`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                const data = (await readJson(response)) as MeResponse;

                if (!response.ok || !data.user) return;

                const nextRole = data.user.role || '';
                const nextPhoto =
                    data.user.profile_photo ||
                    localStorage.getItem('profile_photo') ||
                    '';

                setRole(nextRole);
                setFullname(data.user.fullname || '');
                setProfilePhoto(nextPhoto);

                localStorage.setItem('user_id', data.user.id || '');
                localStorage.setItem('fullname', data.user.fullname || '');
                localStorage.setItem('user_email', data.user.email || '');
                localStorage.setItem('user_role', nextRole || '');
                localStorage.setItem('clinic_id', data.user.clinic_id || '');

                if (nextPhoto) {
                    localStorage.setItem('profile_photo', nextPhoto);
                }
            } catch {
                // fallback dari localStorage
            }
        };

        fetchCurrentUser();

        const handlePhotoUpdated = () => {
            setProfilePhoto(localStorage.getItem('profile_photo') || '');
        };

        window.addEventListener('profile-photo-updated', handlePhotoUpdated);

        return () => {
            window.removeEventListener(
                'profile-photo-updated',
                handlePhotoUpdated,
            );
        };
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
        localStorage.removeItem('profile_photo');

        router.push('/login');
    };

    return (
        <aside className="h-screen w-64 shrink-0">
            <div className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-[#E5ECE1] bg-[#FDFEF9] shadow-[10px_0_30px_rgba(79,111,82,0.08)]">
                <Link
                    href="/dashboard"
                    className="mx-5 mt-5 flex items-center gap-3 rounded-[22px] px-2 py-2 transition-all hover:bg-[#EEF3E9]"
                >
                    <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-white shadow-sm">
                        <Image
                            src="/IBI-logo.webp"
                            alt="Logo NADI"
                            width={52}
                            height={52}
                            className="object-contain"
                        />
                    </div>

                    <div className="min-w-0">
                        <h1 className="text-[24px] font-extrabold leading-none text-[#4F6F52]">
                            NADI
                        </h1>

                        <p className="mt-[5px] truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#739072]">
                            Klinik Digital
                        </p>
                    </div>
                </Link>

                <div className="mx-5 mt-5 rounded-[24px] border border-[#DCE7D6] bg-gradient-to-br from-[#EEF3E9] to-white px-4 py-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#86A789] text-[17px] font-extrabold text-white shadow-sm">
                            {profilePhoto ? (
                                <img
                                    src={profilePhoto}
                                    alt="Foto profil"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span>{initials}</span>
                            )}
                        </div>

                        <div className="min-w-0">
                            <p className="truncate text-[14px] font-extrabold text-[#2F3A2F]">
                                {fullname || 'Pengguna'}
                            </p>

                            <p className="mt-[6px] inline-flex rounded-full bg-[#D2E3C8] px-3 py-[4px] text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#4F6F52]">
                                {formatRole(role)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 px-5">
                    <p className="px-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9AA89A]">
                        Menu Utama
                    </p>
                </div>

                <nav className="mt-3 flex-1 space-y-2 px-5">
                    {visibleNavItems.map((item) => {
                        const active = isActive(item.href);

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[18px] px-4 py-[13px] transition-all ${
                                    active
                                        ? 'bg-[#739072] text-white shadow-md shadow-[#739072]/20'
                                        : 'text-[#2F3A2F] hover:bg-[#EEF3E9]'
                                }`}
                            >
                                {active && (
                                    <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white" />
                                )}

                                <div
                                    className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[12px] transition-all ${
                                        active
                                            ? 'bg-white/15'
                                            : 'bg-white shadow-sm group-hover:bg-[#D2E3C8]'
                                    }`}
                                >
                                    <Image
                                        src={item.icon}
                                        alt={item.label}
                                        width={18}
                                        height={18}
                                        className={`h-[18px] w-[18px] transition-all ${
                                            active
                                                ? 'brightness-0 invert'
                                                : 'opacity-75'
                                        }`}
                                    />
                                </div>

                                <span className="relative z-10 truncate text-[13px] font-bold">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-[#E5ECE1] px-5 py-5">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-[#D2D8CF] bg-white px-4 py-[12px] text-[13px] font-extrabold text-[#4F6F52] shadow-sm transition-all hover:bg-[#EEF3E9] hover:text-[#3F5F42]"
                    >
                        <LogoutIcon />
                        <span>Keluar</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;