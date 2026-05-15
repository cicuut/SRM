'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Cookies from 'js-cookie';
import { House, UsersRound, HeartPulse, Wallet, UserCog, Settings, History    } from 'lucide-react';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type Role = 'admin' | 'midwife' | 'asisten' | '';

type NavItem = {
    label: string;
    href: string;
    icon: React.ElementType;
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
        label: 'Pengaturan Manajemen',
        href: '/management-setting',
        icon: UserCog,
        roles: ['admin'],
    },
    {
        label: 'Pengaturan Akun',
        href: '/account-setting',
        icon: Settings ,
        roles: ['admin', 'midwife', 'asisten'],
    },
    {
        label: 'Riwayat Aktivitas',
        href: '/activity-history',
        icon:History ,
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

const MenuIcon = () => {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M4 7H20M4 12H20M4 17H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
};

const CloseIcon = () => {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M6 6L18 18M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
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
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const initials = getInitials(fullname || 'User');

    useEffect(() => {
        const savedRole = localStorage.getItem('user_role') as Role | null;
        const savedFullname = localStorage.getItem('fullname') || '';
        const savedPhoto = localStorage.getItem('profile_photo') || '';

        if (savedRole) setRole(savedRole);
        if (savedFullname) setFullname(savedFullname);
        if (savedPhoto) setProfilePhoto(savedPhoto);

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
                // Gunakan data dari localStorage kalau request gagal
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

    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

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

    const SidebarText = ({
        children,
        mobile,
        className = '',
    }: {
        children: React.ReactNode;
        mobile?: boolean;
        className?: string;
    }) => {
        return (
            <div
                className={`min-w-0 overflow-hidden whitespace-nowrap transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    mobile
                        ? 'opacity-100'
                        : 'translate-x-[-6px] opacity-0 group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100'
                } ${className}`}
            >
                {children}
            </div>
        );
    };

    const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => {
        return (
            <div
                className={`group/sidebar flex h-full flex-col overflow-hidden bg-[#FDFEF9] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    mobile ? 'w-[300px]' : 'w-[88px] hover:w-[268px]'
                }`}
            >
                <div className="pt-4">
                    <Link
                        href="/dashboard"
                        className="grid h-[72px] grid-cols-[88px_1fr] items-center rounded-[22px] transition-colors duration-300 hover:bg-[#EEF3E9]"
                    >
                        <div className="flex h-full w-[88px] items-center justify-center">
                            <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-white shadow-sm">
                                <Image
                                    src="/IBI-logo.webp"
                                    alt="Logo NADI"
                                    width={56}
                                    height={56}
                                    className="object-contain"
                                />
                            </div>
                        </div>

                        <SidebarText mobile={mobile} className="pr-4">
                            <h1 className="text-[25px] font-extrabold leading-none text-[#4F6F52]">
                                NADI
                            </h1>

                            <p className="mt-[6px] truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[#739072]">
                                Klinik Digital
                            </p>
                        </SidebarText>
                    </Link>
                </div>

                <div className="mx-3 mt-4 rounded-[24px] border border-[#DCE7D6] bg-gradient-to-br from-[#F1F6ED] to-white shadow-sm transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                    <div className="grid min-h-[76px] grid-cols-[62px_1fr] items-center">
                        <div className="flex h-full w-[62px] items-center justify-center">
                            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#86A789] text-[17px] font-extrabold text-white shadow-sm">
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
                        </div>

                        <SidebarText mobile={mobile} className="pr-3">
                            <p className="truncate text-[14px] font-extrabold text-[#2F3A2F]">
                                {fullname || 'Pengguna'}
                            </p>

                            <p className="mt-[7px] inline-flex rounded-full bg-[#D2E3C8] px-3 py-[4px] text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#4F6F52]">
                                {formatRole(role)}
                            </p>
                        </SidebarText>
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-[88px_1fr] items-center">
                    <div className="text-center text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9AA89A] transition-opacity duration-300 group-hover/sidebar:opacity-0">
                        Menu
                    </div>

                    <SidebarText mobile={mobile} className="pr-4">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9AA89A]">
                            Menu Utama
                        </p>
                    </SidebarText>
                </div>

                <nav className="mt-3 flex flex-1 flex-col gap-[7px] px-3 pb-3">
                    {visibleNavItems.map((item) => {
                        const active = isActive(item.href);

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                title={item.label}
                                className={`group/item relative grid h-[45px] grid-cols-[62px_1fr] items-center overflow-hidden rounded-[18px] transition-colors duration-300 ${
                                    active
                                        ? 'bg-[#739072] text-white shadow-md shadow-[#739072]/20'
                                        : 'text-[#2F3A2F] hover:bg-[#EEF3E9]'
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

                                <SidebarText mobile={mobile} className="pr-4">
                                    <span className="truncate text-[13px] font-bold">
                                        {item.label}
                                    </span>
                                </SidebarText>
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-[#E5ECE1] px-3 py-3">
                    <button
                        type="button"
                        onClick={handleLogout}
                        title="Keluar"
                        className="grid h-[44px] w-full grid-cols-[62px_1fr] items-center overflow-hidden rounded-[18px] border border-[#D2D8CF] bg-white text-[13px] font-extrabold text-[#4F6F52] shadow-sm transition-colors duration-300 hover:bg-[#EEF3E9]"
                    >
                        <div className="flex h-full w-[62px] items-center justify-center">
                            <LogoutIcon />
                        </div>

                        <SidebarText mobile={mobile} className="pr-4">
                            <span>Keluar</span>
                        </SidebarText>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            <aside className="hidden h-screen w-[88px] shrink-0 lg:block">
                <div className="fixed left-0 top-0 z-40 h-screen w-[88px] overflow-visible border-r border-[#E5ECE1] shadow-[10px_0_30px_rgba(79,111,82,0.08)] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:w-[268px]">
                    <SidebarContent />
                </div>
            </aside>

            <div className="fixed left-4 top-4 z-50 lg:hidden">
                <button
                    type="button"
                    onClick={() => setIsMobileOpen(true)}
                    className="flex h-[44px] w-[44px] items-center justify-center rounded-[16px] bg-[#739072] text-white shadow-lg shadow-[#739072]/25"
                    aria-label="Buka menu"
                >
                    <MenuIcon />
                </button>
            </div>

            {isMobileOpen && (
                <div className="fixed inset-0 z-[60] lg:hidden">
                    <button
                        type="button"
                        aria-label="Tutup menu"
                        className="absolute inset-0 bg-black/35"
                        onClick={() => setIsMobileOpen(false)}
                    />

                    <div className="absolute left-0 top-0 h-full w-[300px] max-w-[86%] overflow-hidden shadow-2xl">
                        <SidebarContent mobile />
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsMobileOpen(false)}
                        className="absolute right-4 top-4 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white text-[#4F6F52] shadow-lg"
                        aria-label="Tutup menu"
                    >
                        <CloseIcon />
                    </button>
                </div>
            )}
        </>
    );
};

export default Sidebar;