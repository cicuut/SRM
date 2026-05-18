'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import LoadingOverlay from '@/components/loading';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type AccountFormData = {
    fullname: string;
    email: string;
    strnumber: string;
    role: string;
};

type PasswordFormData = {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
};

type UserData = {
    id: string;
    fullname: string;
    email: string;
    role?: string;
    user_role?: string;
    strnumber?: string | null;
    clinic_id?: string | null;
    is_active?: boolean;
    profile_photo?: string | null;
    created_at?: string | null;
    last_login?: string | null;
};

type ClinicData = {
    id: string;
    clinic_name: string;
    clinic_address: string;
    license_number: string;
    clinic_email: string;
    clinic_phone: string;
};

type AccountApiResponse = {
    msg?: string;
    user?: UserData;
    clinic?: ClinicData | null;
};

type PersonalFieldConfig = {
    label: string;
    name: keyof AccountFormData;
    type?: string;
    autoComplete?: string;
    readOnly?: boolean;
};

type InfoItemProps = {
    label: string;
    value?: string | null;
};

const emptyAccountForm: AccountFormData = {
    fullname: '',
    email: '',
    strnumber: '',
    role: '',
};

const emptyPasswordForm: PasswordFormData = {
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
};

const personalFields: PersonalFieldConfig[] = [
    {
        label: 'Full Name',
        name: 'fullname',
        autoComplete: 'name',
    },
    {
        label: 'Email',
        name: 'email',
        type: 'email',
        autoComplete: 'email',
    },
    {
        label: 'STR Number',
        name: 'strnumber',
    },
];

const inputClassName =
    'mt-[8px] h-[34px] w-full min-w-0 box-border rounded-[6px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-[#222222] shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072] disabled:cursor-not-allowed disabled:bg-[#F8FAF6] disabled:opacity-70';

const readonlyInputClassName =
    'mt-[8px] h-[34px] w-full min-w-0 cursor-not-allowed rounded-[6px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[12px] text-[#5F5F5F] shadow-sm outline-none';

const labelClassName = 'text-[11px] font-bold text-black';

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const formatRole = (role: string) => {
    if (!role) return '-';

    if (role === 'asisten') return 'Asisten';

    return role
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
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

const mapApiDataToForm = (data: AccountApiResponse): AccountFormData => {
    const role = data.user?.role || data.user?.user_role || '';

    return {
        fullname: data.user?.fullname || '',
        email: data.user?.email || '',
        strnumber: data.user?.strnumber || '',
        role,
    };
};

const fileToDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(String(reader.result || ''));
        };

        reader.onerror = () => {
            reject(new Error('Gagal membaca file gambar'));
        };

        reader.readAsDataURL(file);
    });
};

const InfoItem = ({ label, value }: InfoItemProps) => {
    return (
        <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                {label}
            </p>

            <p className="mt-[6px] min-h-[18px] break-words text-[12px] font-semibold text-black">
                {value || '-'}
            </p>
        </div>
    );
};

const AccountSetting = () => {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [formData, setFormData] =
        useState<AccountFormData>(emptyAccountForm);

    const [passwordForm, setPasswordForm] =
        useState<PasswordFormData>(emptyPasswordForm);

    const [clinic, setClinic] = useState<ClinicData | null>(null);
    const [profilePhoto, setProfilePhoto] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const displayName = formData.fullname || 'User';
    const displayRole = formatRole(formData.role);
    const initials = getInitials(displayName);

    const showLoadingOverlay =
        isLoading || isSubmitting || isUpdatingPhoto || isChangingPassword;

    const getToken = () => {
        return Cookies.get('access_token');
    };

    const handleUnauthorized = () => {
        Cookies.remove('access_token');

        localStorage.removeItem('user_id');
        localStorage.removeItem('fullname');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('clinic_id');
        localStorage.removeItem('profile_photo');

        router.push('/login');
    };

    const syncLocalStorage = (data: AccountApiResponse) => {
        if (!data.user) return;

        const role = data.user.role || data.user.user_role || '';

        localStorage.setItem('user_id', data.user.id || '');
        localStorage.setItem('fullname', data.user.fullname || '');
        localStorage.setItem('user_email', data.user.email || '');
        localStorage.setItem('user_role', role || '');
        localStorage.setItem('clinic_id', data.user.clinic_id || '');

        if (data.user.profile_photo) {
            localStorage.setItem('profile_photo', data.user.profile_photo);
            setProfilePhoto(data.user.profile_photo);
        }

        window.dispatchEvent(new Event('profile-photo-updated'));
    };

    const fetchAccountData = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');
            setSuccessMessage('');

            const savedPhoto = localStorage.getItem('profile_photo') || '';
            setProfilePhoto(savedPhoto);

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = (await readJson(response)) as AccountApiResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok || !data.user) {
                throw new Error(data?.msg || 'Gagal mengambil data akun');
            }

            setFormData(mapApiDataToForm(data));
            setClinic(data.clinic || null);
            syncLocalStorage(data);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil data akun';

            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAccountData();

        const handleAutoRefresh = () => {
            fetchAccountData();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchAccountData();
            }
        };

        window.addEventListener('focus', handleAutoRefresh);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleAutoRefresh);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const fieldName = event.target.name as keyof AccountFormData;

        if (fieldName === 'role') return;

        const { value } = event.target;

        setSuccessMessage('');
        setErrorMessage('');

        setFormData((prevData) => ({
            ...prevData,
            [fieldName]: value,
        }));
    };

    const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
        const fieldName = event.target.name as keyof PasswordFormData;
        const { value } = event.target;

        setSuccessMessage('');
        setErrorMessage('');

        setPasswordForm((prevData) => ({
            ...prevData,
            [fieldName]: value,
        }));
    };

    const validateProfileForm = () => {
        if (!formData.fullname.trim()) {
            return 'Full name wajib diisi';
        }

        if (!formData.email.trim()) {
            return 'Email wajib diisi';
        }

        if (!formData.email.includes('@')) {
            return 'Format email tidak valid';
        }

        if (!formData.strnumber.trim()) {
            return 'STR number wajib diisi';
        }

        return '';
    };

    const validatePasswordForm = () => {
        if (
            !passwordForm.currentPassword ||
            !passwordForm.newPassword ||
            !passwordForm.confirmNewPassword
        ) {
            return 'Semua field password wajib diisi';
        }

        if (passwordForm.newPassword.length < 8) {
            return 'Password baru minimal 8 karakter';
        }

        if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
            return 'Konfirmasi password baru tidak sama';
        }

        if (passwordForm.currentPassword === passwordForm.newPassword) {
            return 'Password baru tidak boleh sama dengan password lama';
        }

        return '';
    };

    const updateProfile = async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fullname: formData.fullname.trim(),
                email: formData.email.trim(),
                strnumber: formData.strnumber.trim(),
            }),
        });

        const data = (await readJson(response)) as AccountApiResponse;

        if (response.status === 401 || response.status === 422) {
            handleUnauthorized();
            return null;
        }

        if (!response.ok || !data.user) {
            throw new Error(data?.msg || 'Gagal memperbarui data akun');
        }

        return data;
    };

    const updateProfilePhotoToBackend = async (
        token: string,
        photoDataUrl: string,
    ) => {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                profile_photo: photoDataUrl,
            }),
        });

        const data = (await readJson(response)) as AccountApiResponse;

        if (response.status === 401 || response.status === 422) {
            handleUnauthorized();
            return null;
        }

        if (!response.ok) {
            throw new Error(
                data?.msg ||
                    'Foto sudah berubah di tampilan, tapi backend belum menerima field profile_photo.',
            );
        }

        return data;
    };

    const handleUpdatePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const handlePhotoChange = async (
        event: ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];

        if (!file) return;

        try {
            setIsUpdatingPhoto(true);
            setErrorMessage('');
            setSuccessMessage('');

            if (!file.type.startsWith('image/')) {
                throw new Error('File harus berupa gambar');
            }

            if (file.size > 2 * 1024 * 1024) {
                throw new Error('Ukuran foto maksimal 2MB');
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const photoDataUrl = await fileToDataUrl(file);

            setProfilePhoto(photoDataUrl);
            localStorage.setItem('profile_photo', photoDataUrl);
            window.dispatchEvent(new Event('profile-photo-updated'));

            try {
                const updatedData = await updateProfilePhotoToBackend(
                    token,
                    photoDataUrl,
                );

                if (updatedData?.user) {
                    syncLocalStorage(updatedData);
                }

                setSuccessMessage('Profile photo berhasil diperbarui');
            } catch (backendError) {
                const message =
                    backendError instanceof Error
                        ? backendError.message
                        : 'Foto berubah di browser, tapi belum tersimpan ke backend';

                setSuccessMessage(
                    'Profile photo berhasil diperbarui di tampilan browser.',
                );
                setErrorMessage(message);
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat update photo';

            setErrorMessage(message);
        } finally {
            setIsUpdatingPhoto(false);
            event.target.value = '';
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setIsSubmitting(true);
            setErrorMessage('');
            setSuccessMessage('');

            const validationMessage = validateProfileForm();

            if (validationMessage) {
                setErrorMessage(validationMessage);
                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const updatedAccount = await updateProfile(token);

            if (!updatedAccount) {
                return;
            }

            setFormData(mapApiDataToForm(updatedAccount));
            setClinic(updatedAccount.clinic || null);
            syncLocalStorage(updatedAccount);

            setSuccessMessage('Account setting berhasil diperbarui');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat memperbarui account setting';

            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openPasswordModal = () => {
        setPasswordForm(emptyPasswordForm);
        setErrorMessage('');
        setSuccessMessage('');
        setIsPasswordModalOpen(true);
    };

    const closePasswordModal = () => {
        if (isChangingPassword) return;

        setPasswordForm(emptyPasswordForm);
        setIsPasswordModalOpen(false);
    };

    const handleChangePassword = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        try {
            setIsChangingPassword(true);
            setErrorMessage('');
            setSuccessMessage('');

            const validationMessage = validatePasswordForm();

            if (validationMessage) {
                setErrorMessage(validationMessage);
                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    current_password: passwordForm.currentPassword,
                    new_password: passwordForm.newPassword,
                    confirm_new_password: passwordForm.confirmNewPassword,
                }),
            });

            const data = await readJson(response);

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal mengganti password');
            }

            setPasswordForm(emptyPasswordForm);
            setIsPasswordModalOpen(false);
            setSuccessMessage('Password berhasil diperbarui');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengganti password';

            setErrorMessage(message);
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <>
            <div className="relative box-border w-full max-w-none min-w-0">
                {showLoadingOverlay && <LoadingOverlay />}

                <div className="box-border flex min-h-[136px] w-full max-w-full flex-col gap-[18px] rounded-[4px] bg-[#86A789] px-4 py-[22px] shadow-md sm:px-[38px] lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-[22px]">
                        <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FDFEF9] text-[26px] font-bold text-[#5F785F]">
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

                        <div className="min-w-0">
                            <h2 className="truncate text-[26px] font-bold leading-none text-white">
                                {isLoading ? 'Loading...' : displayName}
                            </h2>

                            <p className="mt-[12px] truncate text-[14px] font-bold leading-none text-white">
                                {isLoading ? 'Loading role...' : displayRole}
                            </p>

                            <p className="mt-[10px] truncate text-[13px] font-semibold leading-none text-white">
                                {clinic?.clinic_name || 'Clinic belum tersedia'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-[12px] lg:justify-end">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="hidden"
                        />

                        <button
                            type="button"
                            onClick={handleUpdatePhotoClick}
                            disabled={isUpdatingPhoto || isLoading}
                            className="h-[38px] shrink-0 rounded-[50px] bg-white px-[24px] text-[14px] font-bold text-[#5F785F] shadow-sm transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isUpdatingPhoto ? 'Updating...' : 'Update Photo'}
                        </button>
                    </div>
                </div>

                {errorMessage && (
                    <div className="mt-[18px] box-border w-full rounded-[8px] border border-red-200 bg-red-50 px-[16px] py-[10px] text-[12px] text-red-700">
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="mt-[18px] box-border w-full rounded-[8px] border border-green-200 bg-green-50 px-[16px] py-[10px] text-[12px] text-green-700">
                        {successMessage}
                    </div>
                )}

                {isLoading ? (
                    <div className="mt-[26px] box-border w-full rounded-[8px] border border-[#D2D8CF] bg-white px-[30px] py-[28px] text-[12px] text-black">
                        Mengambil data akun...
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="mt-[26px] box-border w-full max-w-full"
                    >
                        <section className="box-border w-full max-w-full rounded-[8px] border border-[#D2D8CF] bg-white px-4 py-[28px] shadow-sm sm:px-[30px]">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h2 className="text-[16px] leading-none font-bold text-black">
                                        Personal Information
                                    </h2>

                                    <p className="mt-[8px] text-[10px] leading-snug text-black">
                                        Ubah data utama akun yang sedang login.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={openPasswordModal}
                                    className="h-[34px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-[#4B4B4B] shadow-sm transition-all hover:border-[#739072] hover:bg-[#F8FAF6]"
                                >
                                    Change Password
                                </button>
                            </div>

                            <div className="mt-[22px] grid w-full min-w-0 grid-cols-1 gap-x-[52px] gap-y-[14px] md:grid-cols-2">
                                {personalFields.map((field) => (
                                    <label
                                        key={field.name}
                                        className="block min-w-0"
                                    >
                                        <span className={labelClassName}>
                                            {field.label}
                                        </span>

                                        <input
                                            name={field.name}
                                            type={field.type || 'text'}
                                            value={formData[field.name]}
                                            onChange={handleChange}
                                            disabled={isSubmitting}
                                            autoComplete={
                                                field.autoComplete || 'off'
                                            }
                                            className={inputClassName}
                                        />
                                    </label>
                                ))}

                                <label className="block min-w-0">
                                    <span className={labelClassName}>Role</span>

                                    <input
                                        type="text"
                                        value={displayRole}
                                        readOnly
                                        className={readonlyInputClassName}
                                    />
                                </label>
                            </div>
                        </section>

                        <section className="mt-[26px] box-border w-full max-w-full rounded-[8px] border border-[#D2D8CF] bg-white px-4 py-[28px] shadow-sm sm:px-[30px]">
                            <div>
                                <h2 className="text-[16px] leading-none font-bold text-black">
                                    Clinic Information
                                </h2>

                                <p className="mt-[8px] text-[10px] leading-snug text-black">
                                    Informasi klinik ditampilkan seperlunya.
                                </p>
                            </div>

                            <div className="mt-[22px] grid w-full min-w-0 grid-cols-1 gap-x-[52px] gap-y-[16px] md:grid-cols-2">
                                <InfoItem
                                    label="SIPB No"
                                    value={clinic?.license_number}
                                />
                                <InfoItem
                                    label="Clinic Email"
                                    value={clinic?.clinic_email}
                                />
                                <InfoItem
                                    label="Clinic Phone"
                                    value={clinic?.clinic_phone}
                                />

                                <div className="md:col-span-2">
                                    <InfoItem
                                        label="Clinic Address"
                                        value={clinic?.clinic_address}
                                    />
                                </div>
                            </div>
                        </section>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="mt-[26px] h-[34px] rounded-[50px] bg-[#86A789] px-[22px] text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isSubmitting ? 'Updating...' : 'Update Changes'}
                        </button>
                    </form>
                )}
            </div>

            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
                    <div className="relative box-border w-full max-w-[460px] overflow-hidden rounded-[18px] border border-[#D2E3C8] bg-white shadow-2xl">
                        <button
                            type="button"
                            onClick={closePasswordModal}
                            disabled={isChangingPassword}
                            className="absolute right-[18px] top-[16px] z-10 flex h-[28px] w-[28px] items-center justify-center rounded-full text-[22px] leading-none text-[#2F2F2F] transition-all hover:bg-[#EEF3EA] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Close change password modal"
                        >
                            ×
                        </button>

                        <div className="border-b border-[#E4E8E1] px-[26px] py-[22px]">
                            <h2 className="text-[22px] font-bold leading-tight text-[#4F6F52]">
                                Change Password
                            </h2>

                            <p className="mt-1 text-[12px] text-[#6B6B6B]">
                                Masukkan password lama dan password baru.
                            </p>
                        </div>

                        <form
                            onSubmit={handleChangePassword}
                            className="px-[26px] py-[24px]"
                        >
                            <div className="grid grid-cols-1 gap-[14px]">
                                <label className="block min-w-0">
                                    <span className={labelClassName}>
                                        Current Password
                                    </span>

                                    <input
                                        type="password"
                                        name="currentPassword"
                                        value={passwordForm.currentPassword}
                                        onChange={handlePasswordChange}
                                        autoComplete="current-password"
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className={labelClassName}>
                                        New Password
                                    </span>

                                    <input
                                        type="password"
                                        name="newPassword"
                                        value={passwordForm.newPassword}
                                        onChange={handlePasswordChange}
                                        autoComplete="new-password"
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className={labelClassName}>
                                        Confirm New Password
                                    </span>

                                    <input
                                        type="password"
                                        name="confirmNewPassword"
                                        value={
                                            passwordForm.confirmNewPassword
                                        }
                                        onChange={handlePasswordChange}
                                        autoComplete="new-password"
                                        className={inputClassName}
                                    />
                                </label>
                            </div>

                            <div className="mt-[22px] flex items-center justify-end gap-[10px]">
                                <button
                                    type="button"
                                    onClick={closePasswordModal}
                                    disabled={isChangingPassword}
                                    className="h-[36px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-black transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={isChangingPassword}
                                    className="h-[36px] rounded-[50px] bg-[#86A789] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isChangingPassword
                                        ? 'Updating...'
                                        : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default AccountSetting;