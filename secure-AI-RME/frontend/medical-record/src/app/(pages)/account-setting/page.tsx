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

type FieldConfig = {
    label: string;
    name: keyof AccountFormData;
    type?: string;
    fullWidth?: boolean;
    autoComplete?: string;
    readOnly?: boolean;
};

type SectionCardProps = {
    title: string;
    description: string;
    fields: FieldConfig[];
    formData: AccountFormData;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    className?: string;
};

type InfoItemProps = {
    label: string;
    value?: string | null;
};

type ClinicSummaryProps = {
    clinic: ClinicData | null;
};

const emptyFormData: AccountFormData = {
    fullname: '',
    email: '',
    strnumber: '',
    role: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
};

const inputClassName =
    'mt-[6px] h-[28px] w-full min-w-0 box-border rounded-[4px] border border-[#BFC7BB] bg-white px-2 text-[11px] text-[#222222] shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

const personalFields: FieldConfig[] = [
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
    {
        label: 'Role',
        name: 'role',
        readOnly: true,
    },
];

const passwordFields: FieldConfig[] = [
    {
        label: 'Current Password',
        name: 'currentPassword',
        type: 'password',
        fullWidth: true,
        autoComplete: 'current-password',
    },
    {
        label: 'New Password',
        name: 'newPassword',
        type: 'password',
        autoComplete: 'new-password',
    },
    {
        label: 'Confirm New Password',
        name: 'confirmNewPassword',
        type: 'password',
        autoComplete: 'new-password',
    },
];

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
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    };
};

const wantsPasswordChange = (formData: AccountFormData) => {
    return Boolean(
        formData.currentPassword ||
            formData.newPassword ||
            formData.confirmNewPassword,
    );
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

const SectionCard = ({
    title,
    description,
    fields,
    formData,
    onChange,
    disabled = false,
    className = '',
}: SectionCardProps) => {
    return (
        <section
            className={`box-border w-full max-w-full rounded-[8px] border border-[#D2D8CF] bg-white px-4 py-[28px] shadow-sm sm:px-[30px] ${className}`}
        >
            <h2 className="text-[16px] leading-none font-bold text-black">
                {title}
            </h2>

            <p className="mt-[8px] text-[10px] leading-snug text-black">
                {description}
            </p>

            <div className="mt-[22px] grid w-full min-w-0 grid-cols-1 gap-x-[52px] gap-y-[14px] md:grid-cols-2">
                {fields.map((field) => {
                    const isReadOnly = Boolean(field.readOnly);
                    const fieldValue =
                        field.name === 'role'
                            ? formatRole(formData.role)
                            : formData[field.name];

                    return (
                        <label
                            key={field.name}
                            className={`block min-w-0 ${
                                field.fullWidth ? 'md:col-span-2' : ''
                            }`}
                        >
                            <span className="text-[10px] font-medium text-black">
                                {field.label}
                            </span>

                            <input
                                name={field.name}
                                type={field.type || 'text'}
                                value={fieldValue}
                                onChange={onChange}
                                readOnly={isReadOnly}
                                disabled={disabled}
                                autoComplete={field.autoComplete || 'off'}
                                className={`${inputClassName} ${
                                    isReadOnly
                                        ? 'cursor-not-allowed bg-[#F2F4F0] text-[#6B6B6B]'
                                        : ''
                                } ${
                                    disabled
                                        ? 'cursor-not-allowed opacity-70'
                                        : ''
                                }`}
                            />
                        </label>
                    );
                })}
            </div>
        </section>
    );
};

const ClinicSummary = ({ clinic }: ClinicSummaryProps) => {
    return (
        <section className="mt-[26px] box-border w-full max-w-full rounded-[8px] border border-[#D2D8CF] bg-white px-4 py-[28px] shadow-sm sm:px-[30px]">
            <div>
                <h2 className="text-[16px] leading-none font-bold text-black">
                    Clinic Summary
                </h2>

                <p className="mt-[8px] text-[10px] leading-snug text-black">
                    Data klinik ditampilkan di sini sebagai informasi akun.
                </p>
            </div>

            <div className="mt-[22px] grid w-full min-w-0 grid-cols-1 gap-x-[52px] gap-y-[16px] md:grid-cols-2">
                <InfoItem label="Clinic Name" value={clinic?.clinic_name} />
                <InfoItem label="SIPB No" value={clinic?.license_number} />
                <InfoItem label="Clinic Email" value={clinic?.clinic_email} />
                <InfoItem label="Clinic Phone" value={clinic?.clinic_phone} />

                <div className="md:col-span-2">
                    <InfoItem
                        label="Clinic Address"
                        value={clinic?.clinic_address}
                    />
                </div>
            </div>
        </section>
    );
};

const AccountSetting = () => {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [formData, setFormData] =
        useState<AccountFormData>(emptyFormData);
    const [clinic, setClinic] = useState<ClinicData | null>(null);
    const [profilePhoto, setProfilePhoto] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const displayName = formData.fullname || 'User';
    const displayRole = formatRole(formData.role);
    const initials = getInitials(displayName);

    const showLoadingOverlay = isLoading || isSubmitting || isUpdatingPhoto;

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

        setFormData((prevData) => ({
            ...prevData,
            [fieldName]: value,
        }));
    };

    const validateForm = () => {
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

        if (wantsPasswordChange(formData)) {
            if (
                !formData.currentPassword ||
                !formData.newPassword ||
                !formData.confirmNewPassword
            ) {
                return 'Semua field password wajib diisi jika ingin mengganti password';
            }

            if (formData.newPassword.length < 8) {
                return 'Password baru minimal 8 karakter';
            }

            if (formData.newPassword !== formData.confirmNewPassword) {
                return 'Konfirmasi password baru tidak sama';
            }

            if (formData.currentPassword === formData.newPassword) {
                return 'Password baru tidak boleh sama dengan password lama';
            }
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

    const changePassword = async (token: string) => {
        if (!wantsPasswordChange(formData)) {
            return;
        }

        const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                current_password: formData.currentPassword,
                new_password: formData.newPassword,
                confirm_new_password: formData.confirmNewPassword,
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
    };

    const handleUpdatePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setErrorMessage('File harus berupa gambar');
            event.target.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setErrorMessage('Ukuran foto maksimal 2MB');
            event.target.value = '';
            return;
        }

        try {
            setIsUpdatingPhoto(true);
            setErrorMessage('');
            setSuccessMessage('');

            const reader = new FileReader();

            reader.onload = () => {
                const result = String(reader.result || '');

                setProfilePhoto(result);
                localStorage.setItem('profile_photo', result);
                window.dispatchEvent(new Event('profile-photo-updated'));

                setSuccessMessage('Profile photo berhasil diperbarui');
                setIsUpdatingPhoto(false);
                event.target.value = '';
            };

            reader.onerror = () => {
                setErrorMessage('Gagal membaca file gambar');
                setIsUpdatingPhoto(false);
                event.target.value = '';
            };

            reader.readAsDataURL(file);
        } catch {
            setErrorMessage('Terjadi kesalahan saat update photo');
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

            const validationMessage = validateForm();

            if (validationMessage) {
                setErrorMessage(validationMessage);
                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const isChangingPassword = wantsPasswordChange(formData);

            const updatedAccount = await updateProfile(token);

            if (!updatedAccount) {
                return;
            }

            await changePassword(token);

            setFormData(mapApiDataToForm(updatedAccount));
            setClinic(updatedAccount.clinic || null);
            syncLocalStorage(updatedAccount);

            setSuccessMessage(
                isChangingPassword
                    ? 'Account setting dan password berhasil diperbarui'
                    : 'Account setting berhasil diperbarui',
            );
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

    return (
        <div className="relative box-border w-full max-w-none min-w-0">
            {showLoadingOverlay && <LoadingOverlay />}
            <div className="mt-[28px] box-border flex min-h-[104px] w-full max-w-full flex-col gap-[18px] rounded-l-[8px] bg-[#86A789] px-4 py-[22px] shadow-md sm:px-[38px] lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-[22px]">
                    <div className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FDFEF9] text-[24px] font-bold text-[#5F785F]">
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
                        <h2 className="truncate text-[22px] font-bold leading-none text-white">
                            {isLoading ? 'Loading...' : displayName}
                        </h2>

                        <p className="mt-[8px] truncate text-[12px] font-medium leading-none text-white">
                            {isLoading ? 'Loading role...' : displayRole}
                        </p>

                        <p className="mt-[8px] truncate text-[11px] font-medium leading-none text-white/90">
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
                        className="h-[32px] shrink-0 rounded-[50px] bg-white px-[18px] text-[12px] font-bold text-[#5F785F] shadow-sm transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {isUpdatingPhoto ? 'Updating...' : 'Update Photo'}
                    </button>
                </div>
            </div>

            {errorMessage && (
                <div className="mt-[18px] box-border w-full rounded-l-[6px] border border-red-200 bg-red-50 px-[16px] py-[10px] text-[12px] text-red-700">
                    {errorMessage}
                </div>
            )}

            {successMessage && (
                <div className="mt-[18px] box-border w-full rounded-l-[6px] border border-green-200 bg-green-50 px-[16px] py-[10px] text-[12px] text-green-700">
                    {successMessage}
                </div>
            )}

            {isLoading ? (
                <div className="mt-[26px] box-border w-full rounded-l-[8px] border border-[#D2D8CF] bg-white px-[30px] py-[28px] text-[12px] text-black">
                    Mengambil data akun...
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    className="mt-[26px] box-border w-full max-w-full"
                >
                    <SectionCard
                        title="Personal Information"
                        description="Data ini diambil dari akun user yang sedang login"
                        fields={personalFields}
                        formData={formData}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        className="min-h-[220px] rounded-r-none"
                    />

                    <ClinicSummary clinic={clinic} />

                    <SectionCard
                        title="Change Password"
                        description="Kosongkan bagian ini jika tidak ingin mengganti password"
                        fields={passwordFields}
                        formData={formData}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        className="mt-[26px] min-h-[170px] rounded-r-none"
                    />

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
    );
};

export default AccountSetting;