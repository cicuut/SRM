'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Cookies from 'js-cookie';
import api from '@/utils/app';
import LoadingOverlay from '@/components/loading';

interface DateLabelProps {
    className?: string;
    emptyValue?: string;
}

export const DateLabel = ({
    className,
    emptyValue = '\u00A0',
}: DateLabelProps) => {
    const [dateLabel, setDateLabel] = useState<string>('');

    const dateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat('id-ID', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            }),
        [],
    );

    useEffect(() => {
        setDateLabel(dateFormatter.format(new Date()));
    }, [dateFormatter]);

    return <p className={className}>{dateLabel || emptyValue}</p>;
};

interface CurrentUser {
    fullname: string;
    role: string;
    profile_photo?: string | null;
}

type AuthMeResponse = {
    user: CurrentUser;
};

function formatDisplayRole(role: string): string {
    if (!role.trim()) return '';

    if (role === 'asisten') return 'Asisten';

    return role
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function getInitials(name: string): string {
    const initials = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return initials || 'U';
}

const Dashboard = () => {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [profilePhoto, setProfilePhoto] = useState('');
    const [loading, setLoading] = useState(true);

    const displayName = currentUser?.fullname?.trim() || '';
    const displayRole = currentUser?.role
        ? formatDisplayRole(currentUser.role)
        : '';
    const initials = getInitials(displayName);

    const loadLocalProfilePhoto = () => {
        setProfilePhoto(localStorage.getItem('profile_photo') || '');
    };

    useEffect(() => {
        let cancelled = false;

        const token = Cookies.get('access_token');

        loadLocalProfilePhoto();

        if (!token) {
            setLoading(false);
            return;
        }

        const fetchCurrentUser = async () => {
            try {
                const { data } = await api.get<AuthMeResponse>('/auth/me', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (cancelled) return;

                setCurrentUser(data.user);

                const backendProfilePhoto = data.user?.profile_photo || '';

                if (backendProfilePhoto) {
                    localStorage.setItem('profile_photo', backendProfilePhoto);
                    setProfilePhoto(backendProfilePhoto);
                } else {
                    loadLocalProfilePhoto();
                }
            } catch (error) {
                console.error('Failed to load current user:', error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchCurrentUser();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const handleProfilePhotoUpdated = () => {
            loadLocalProfilePhoto();
        };

        const handleStorageChange = () => {
            loadLocalProfilePhoto();
        };

        window.addEventListener(
            'profile-photo-updated',
            handleProfilePhotoUpdated,
        );
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('focus', handleProfilePhotoUpdated);

        return () => {
            window.removeEventListener(
                'profile-photo-updated',
                handleProfilePhotoUpdated,
            );
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('focus', handleProfilePhotoUpdated);
        };
    }, []);

    return (
        <div>
            <div className="flex w-full flex-1 flex-col">
                {loading && <LoadingOverlay />}

                <div className="ml-5 mt-5 flex flex-col gap-y-6.25">
                    <div className="flex w-full gap-x-5">
                        <div className="flex flex-1 flex-row gap-x-[30] rounded-[30px] bg-[#739072] px-8 py-5 pb-0 text-white">
                            <div className="flex w-sm flex-1 flex-col gap-y-[10]">
                                <h1 className="text-[25px] font-bold">
                                    {displayName ? `Hi, ${displayName}!` : 'Hi!'}
                                </h1>

                                <p className="text-[20px]">
                                    Selamat Datang Kembali di Sistem Informasi
                                    dan Manajemen Klinik.{' '}
                                </p>

                                <DateLabel className="text-[20px]" />
                            </div>

                            <div className="illustration">
                                <Image
                                    src="/doctor-icon.png"
                                    alt="img"
                                    width={160}
                                    height={160}
                                />
                            </div>
                        </div>

                        <div className="flex w-md flex-col items-center gap-y-1.25 rounded-[30px] bg-[#739072] px-8 py-5 pb-0 text-[15px] text-white">
                            <div className="flex h-[80px] w-[80px] items-center justify-center overflow-hidden rounded-full bg-[#FDFEF9] text-[26px] font-bold text-[#5F785F] shadow-sm">
                                {profilePhoto ? (
                                    <img
                                        src={profilePhoto}
                                        alt="Profile photo"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span>{initials}</span>
                                )}
                            </div>

                            <p>{displayName || '\u00A0'}</p>
                            <p>{displayRole || '\u00A0'}</p>
                        </div>
                    </div>

                    <div className="flex gap-x-10">
                        <div className="flex-1 rounded-[10px] bg-[#FFFFFF] px-7 py-6 text-center drop-shadow-lg">
                            <h3 className="text-[20px]">
                                Total Pengunjung Bulanan
                            </h3>

                            <p className="text-[20px] font-bold">
                                300 Kunjungan
                            </p>
                        </div>

                        <div className="flex-1 rounded-[10px] bg-[#FFFFFF] px-7 py-6 text-center drop-shadow-lg">
                            <h3 className="text-[20px]">Pemasukan Bulanan</h3>

                            <p className="text-[20px] font-bold">Rp. 500.000</p>
                        </div>

                        <div className="flex-1 rounded-[10px] bg-[#FFFFFF] px-7 py-6 text-center drop-shadow-lg">
                            <h3 className="text-[20px]">Pengeluaran Bulanan</h3>

                            <p className="text-[20px] font-bold">Rp. 100.000</p>
                        </div>
                    </div>

                    <div className="mt-6 flex w-full flex-row gap-6">
                        <div className="flex flex-[1.5] flex-col gap-y-10">
                            <div className="h-130 rounded-[10px] bg-[#FFFFFF] px-5 py-6 text-center drop-shadow-lg">
                                <h1 className="text-xl">
                                    Grafik Pengunjung Bulanan
                                </h1>
                            </div>

                            <div className="h-130 rounded-[10px] bg-[#FFFFFF] px-5 py-6 text-center drop-shadow-lg">
                                <h1 className="text-xl">
                                    Grafik Keuangan Bulanan
                                </h1>
                            </div>
                        </div>

                        <div className="flex flex-1 flex-col gap-y-10">
                            <div className="h-80 rounded-[10px] bg-[#FFFFFF] px-5 py-6 text-center drop-shadow-lg">
                                <h1 className="text-xl">
                                    Perkiraan Pengunjung Bulanan
                                </h1>
                            </div>

                            <div className="flex-1 rounded-[10px] bg-[#FFFFFF] px-5 py-6 text-center drop-shadow-lg">
                                <h1 className="text-xl">
                                    Top 5 Diagnosa Bulanan
                                </h1>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;