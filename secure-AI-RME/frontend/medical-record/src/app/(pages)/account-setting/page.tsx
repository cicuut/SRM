'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '@/components/sidebar';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type AccountFormData = {
    fullname: string;
    email: string;
    strNumber: string;
    role: string;
    clinicName: string;
    sipbNo: string;
    clinicAddress: string;
    clinicPhoneNumber: string;
    clinicEmail: string;
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
};

type FieldConfig = {
    label: string;
    name: keyof AccountFormData;
    type?: string;
    fullWidth?: boolean;
    autoComplete?: string;
    readOnly?: boolean;
};

type AccountApiResponse = {
    msg?: string;
    user: {
        id: string;
        fullname: string;
        email: string;
        role: string;
        strnumber?: string | null;
        clinic_id?: string | null;
    };
    clinic?: {
        id: string;
        clinic_name: string;
        clinic_address: string;
        license_number: string;
        clinic_email: string;
        clinic_phone: string;
    } | null;
};

type SectionCardProps = {
    title: string;
    description: string;
    fields: FieldConfig[];
    formData: AccountFormData;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    className?: string;
    disabled?: boolean;
};

const emptyFormData: AccountFormData = {
    fullname: '',
    email: '',
    strNumber: '',
    role: '',
    clinicName: '',
    sipbNo: '',
    clinicAddress: '',
    clinicPhoneNumber: '',
    clinicEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
};

const inputClassName =
    'mt-[6px] h-[24px] w-full rounded-[3px] border border-[#BFC7BB] bg-transparent px-2 text-[11px] text-[#222222] outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

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
        name: 'strNumber',
    },
    {
        label: 'Role',
        name: 'role',
        readOnly: true,
    },
];

const clinicFields: FieldConfig[] = [
    {
        label: 'Clinic Name',
        name: 'clinicName',
    },
    {
        label: 'SIPB No',
        name: 'sipbNo',
    },
    {
        label: 'Clinic Address',
        name: 'clinicAddress',
        fullWidth: true,
    },
    {
        label: 'Clinic Phone Number',
        name: 'clinicPhoneNumber',
        type: 'tel',
        autoComplete: 'tel',
    },
    {
        label: 'Clinic Email',
        name: 'clinicEmail',
        type: 'email',
        autoComplete: 'email',
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

const formatRole = (role: string) => {
    if (!role) return '-';

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
    return {
        fullname: data.user?.fullname || '',
        email: data.user?.email || '',
        strNumber: data.user?.strnumber || '',
        role: data.user?.role || '',
        clinicName: data.clinic?.clinic_name || '',
        sipbNo: data.clinic?.license_number || '',
        clinicAddress: data.clinic?.clinic_address || '',
        clinicPhoneNumber: data.clinic?.clinic_phone || '',
        clinicEmail: data.clinic?.clinic_email || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    };
};

const hasAnyClinicData = (formData: AccountFormData) => {
    return Boolean(
        formData.clinicName ||
            formData.sipbNo ||
            formData.clinicAddress ||
            formData.clinicPhoneNumber ||
            formData.clinicEmail,
    );
};

const SectionCard = ({
    title,
    description,
    fields,
    formData,
    onChange,
    className = '',
    disabled = false,
}: SectionCardProps) => {
    return (
        <section
            className={`w-full rounded-[8px] border border-[#D2D8CF] bg-transparent px-[30px] py-[28px] ${className}`}
        >
            <h2 className="text-[16px] leading-none font-bold text-black">
                {title}
            </h2>

            <p className="mt-[8px] text-[10px] leading-none text-black">
                {description}
            </p>

            <div className="mt-[22px] grid grid-cols-1 gap-x-[52px] gap-y-[12px] md:grid-cols-[270px_270px]">
                {fields.map((field) => {
                    const isReadOnly = Boolean(field.readOnly);

                    return (
                        <label
                            key={field.name}
                            className={`block ${
                                field.fullWidth ? 'md:col-span-2' : ''
                            }`}
                        >
                            <span className="text-[10px] font-medium text-black">
                                {field.label}
                            </span>

                            <input
                                name={field.name}
                                type={field.type || 'text'}
                                value={formData[field.name]}
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

const AccountSetting = () => {
    const router = useRouter();

    const [formData, setFormData] =
        useState<AccountFormData>(emptyFormData);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasClinic, setHasClinic] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const displayName = formData.fullname || 'User';
    const displayRole = formatRole(formData.role);
    const initials = getInitials(displayName);

    const getToken = () => {
        return Cookies.get('access_token');
    };

    const handleUnauthorized = () => {
        Cookies.remove('access_token');
        router.push('/login');
    };

    const fetchAccountData = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');

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

            const data = await response.json();

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal mengambil data akun');
            }

            setFormData(mapApiDataToForm(data));
            setHasClinic(Boolean(data?.clinic));
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const fieldName = event.target.name as keyof AccountFormData;
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

        if (!formData.strNumber.trim()) {
            return 'STR number wajib diisi';
        }

        if (hasClinic || hasAnyClinicData(formData)) {
            if (!formData.clinicName.trim()) {
                return 'Clinic name wajib diisi';
            }

            if (!formData.sipbNo.trim()) {
                return 'SIPB No wajib diisi';
            }

            if (!formData.clinicAddress.trim()) {
                return 'Clinic address wajib diisi';
            }

            if (!formData.clinicPhoneNumber.trim()) {
                return 'Clinic phone number wajib diisi';
            }

            if (!formData.clinicEmail.trim()) {
                return 'Clinic email wajib diisi';
            }
        }

        const wantsPasswordChange = Boolean(
            formData.currentPassword ||
                formData.newPassword ||
                formData.confirmNewPassword,
        );

        if (wantsPasswordChange) {
            if (
                !formData.currentPassword ||
                !formData.newPassword ||
                !formData.confirmNewPassword
            ) {
                return 'Semua field password wajib diisi jika ingin mengganti password';
            }

            if (formData.newPassword !== formData.confirmNewPassword) {
                return 'Konfirmasi password baru tidak sama';
            }

            if (formData.newPassword.length < 8) {
                return 'Password baru minimal 8 karakter';
            }
        }

        return '';
    };

    const updateProfileAndClinic = async (token: string) => {
        const payload: {
            fullname: string;
            email: string;
            strnumber: string;
            clinic?: {
                clinic_name: string;
                license_number: string;
                clinic_address: string;
                clinic_phone: string;
                clinic_email: string;
            };
        } = {
            fullname: formData.fullname.trim(),
            email: formData.email.trim(),
            strnumber: formData.strNumber.trim(),
        };

        if (hasClinic || hasAnyClinicData(formData)) {
            payload.clinic = {
                clinic_name: formData.clinicName.trim(),
                license_number: formData.sipbNo.trim(),
                clinic_address: formData.clinicAddress.trim(),
                clinic_phone: formData.clinicPhoneNumber.trim(),
                clinic_email: formData.clinicEmail.trim(),
            };
        }

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.status === 401) {
            handleUnauthorized();
            return null;
        }

        if (!response.ok) {
            throw new Error(data?.msg || 'Gagal memperbarui data akun');
        }

        return data as AccountApiResponse;
    };

    const changePassword = async (token: string) => {
        const wantsPasswordChange = Boolean(
            formData.currentPassword ||
                formData.newPassword ||
                formData.confirmNewPassword,
        );

        if (!wantsPasswordChange) {
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

        const data = await response.json();

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error(data?.msg || 'Gagal mengganti password');
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

            const updatedAccount = await updateProfileAndClinic(token);

            if (!updatedAccount) {
                return;
            }

            await changePassword(token);

            setFormData({
                ...mapApiDataToForm(updatedAccount),
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: '',
            });

            setHasClinic(Boolean(updatedAccount?.clinic));
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

    return (
        <div className="min-h-screen flex bg-[#FDFEF9] overflow-x-hidden">
            <Sidebar />

            <main className="flex-1 flex flex-col ml-0 pt-[26px] pb-[40px] pl-[28px] pr-[28px] min-w-0 overflow-x-hidden">
                <div className="w-full max-w-[960px]">
                    <div className="mt-[28px] w-full min-h-[96px] rounded-[8px] bg-[#86A789] px-[38px] py-[22px] shadow-md flex flex-col gap-[18px] md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-[22px]">
                            <div className="relative w-[64px] h-[64px] rounded-full overflow-hidden bg-[#FDFEF9] shrink-0 flex items-center justify-center text-[24px] font-bold text-[#5F785F]">
                                <span>{initials}</span>
                            </div>

                            <div>
                                <h2 className="text-[22px] leading-none font-bold text-white">
                                    {isLoading ? 'Loading...' : displayName}
                                </h2>

                                <p className="mt-[8px] text-[12px] leading-none font-medium text-white">
                                    {isLoading ? 'Loading role...' : displayRole}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-[18px]">
                            <button
                                type="button"
                                disabled
                                className="h-[32px] px-[22px] rounded-[50px] bg-white text-[12px] font-bold text-black shadow-sm opacity-70 cursor-not-allowed"
                                title="Fitur update photo belum tersedia di backend"
                            >
                                Update Photo
                            </button>

                            <button
                                type="button"
                                disabled
                                className="h-[32px] px-[22px] rounded-[50px] bg-white text-[12px] font-bold text-black shadow-sm opacity-70 cursor-not-allowed"
                                title="Fitur delete account belum tersedia di backend"
                            >
                                Delete Account
                            </button>
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="mt-[18px] rounded-[6px] border border-red-200 bg-red-50 px-[16px] py-[10px] text-[12px] text-red-700">
                            {errorMessage}
                        </div>
                    )}

                    {successMessage && (
                        <div className="mt-[18px] rounded-[6px] border border-green-200 bg-green-50 px-[16px] py-[10px] text-[12px] text-green-700">
                            {successMessage}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="mt-[26px] rounded-[8px] border border-[#D2D8CF] px-[30px] py-[28px] text-[12px] text-black">
                            Mengambil data akun...
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="mt-[26px]">
                            <SectionCard
                                title="Personal Information"
                                description="Data ini diambil dari akun user yang sedang login"
                                fields={personalFields}
                                formData={formData}
                                onChange={handleChange}
                                disabled={isSubmitting}
                                className="min-h-[220px]"
                            />

                            <SectionCard
                                title="Clinic Information"
                                description="Data ini diambil dari klinik yang terhubung dengan akun user"
                                fields={clinicFields}
                                formData={formData}
                                onChange={handleChange}
                                disabled={isSubmitting}
                                className="mt-[26px] min-h-[240px]"
                            />

                            <SectionCard
                                title="Change Password"
                                description="Kosongkan bagian ini jika tidak ingin mengganti password"
                                fields={passwordFields}
                                formData={formData}
                                onChange={handleChange}
                                disabled={isSubmitting}
                                className="mt-[26px] min-h-[170px]"
                            />

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="mt-[26px] h-[34px] px-[22px] rounded-[50px] bg-[#86A789] text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isSubmitting
                                    ? 'Updating...'
                                    : 'Update Changes'}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AccountSetting;