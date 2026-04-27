'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Sidebar from '@/components/sidebar';

type AccountFormData = {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    education: string;
    strNumber: string;
    role: string;
    clinicName: string;
    sipbNo: string;
    clinicAddress: string;
    clinicPhoneNumber: string;
    clinicEmail: string;
    clinicStrNumber: string;
    clinicRole: string;
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
};

type SectionCardProps = {
    title: string;
    description: string;
    fields: FieldConfig[];
    formData: AccountFormData;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    className?: string;
};

const inputClassName =
    'mt-[6px] h-[24px] w-full rounded-[3px] border border-[#BFC7BB] bg-transparent px-2 text-[11px] text-[#222222] outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

const personalFields: FieldConfig[] = [
    {
        label: 'First Name',
        name: 'firstName',
    },
    {
        label: 'Last Name',
        name: 'lastName',
    },
    {
        label: 'Email',
        name: 'email',
        type: 'email',
        autoComplete: 'email',
    },
    {
        label: 'Phone Number',
        name: 'phoneNumber',
        type: 'tel',
        autoComplete: 'tel',
    },
    {
        label: 'Education',
        name: 'education',
    },
    {
        label: 'STR number',
        name: 'strNumber',
    },
    {
        label: 'Role',
        name: 'role',
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
    },
    {
        label: 'Clinic Phone Number',
        name: 'clinicPhoneNumber',
        type: 'tel',
    },
    {
        label: 'Clinic Email',
        name: 'clinicEmail',
        type: 'email',
    },
    {
        label: 'STR number',
        name: 'clinicStrNumber',
    },
    {
        label: 'Role',
        name: 'clinicRole',
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

const SectionCard = ({
    title,
    description,
    fields,
    formData,
    onChange,
    className = '',
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

            <div className="mt-[22px] grid grid-cols-1 md:grid-cols-[270px_270px] gap-x-[52px] gap-y-[12px]">
                {fields.map((field) => (
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
                            autoComplete={field.autoComplete || 'off'}
                            className={inputClassName}
                        />
                    </label>
                ))}
            </div>
        </section>
    );
};

const AccountSetting = () => {
    const [formData, setFormData] = useState<AccountFormData>({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        education: '',
        strNumber: '',
        role: '',
        clinicName: '',
        sipbNo: '',
        clinicAddress: '',
        clinicPhoneNumber: '',
        clinicEmail: '',
        clinicStrNumber: '',
        clinicRole: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    });

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;

        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
    };

    return (
        <div className="min-h-screen flex bg-[#FDFEF9] overflow-x-hidden">
            <Sidebar />

            <main className="flex-1 flex flex-col ml-0 pt-[26px] pb-[40px] pl-[28px] pr-[28px] min-w-0 overflow-x-hidden">
                <div className="w-full max-w-[960px]">
                   
                    <div className="mt-[28px] w-full min-h-[96px] rounded-[8px] bg-[#86A789] px-[38px] py-[22px] shadow-md flex items-center justify-between">
                        <div className="flex items-center gap-[22px]">
                            <div className="relative w-[64px] h-[64px] rounded-full overflow-hidden bg-[#FDFEF9] shrink-0 flex items-center justify-center text-[26px] font-bold text-[#5F785F]">
                                <span>C</span>

                                <img
                                    src="/images/profile-cica.jpg"
                                    alt="Cica profile"
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(event) => {
                                        event.currentTarget.style.display =
                                            'none';
                                    }}
                                />
                            </div>

                            <div>
                                <h2 className="text-[22px] leading-none font-bold text-white">
                                    Cica
                                </h2>

                                <p className="mt-[8px] text-[12px] leading-none font-medium text-white">
                                    Owner & Lead Midwife
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-[18px]">
                            <button
                                type="button"
                                className="h-[32px] px-[22px] rounded-[50px] bg-white text-[12px] font-bold text-black shadow-sm transition-all hover:bg-[#F4F4F4]"
                            >
                                Update Photo
                            </button>

                            <button
                                type="button"
                                className="h-[32px] px-[22px] rounded-[50px] bg-white text-[12px] font-bold text-black shadow-sm transition-all hover:bg-[#F4F4F4]"
                            >
                                Delete Account
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-[26px]">
                        <SectionCard
                            title="Personal Information"
                            description="Update your personal information"
                            fields={personalFields}
                            formData={formData}
                            onChange={handleChange}
                            className="min-h-[260px]"
                        />

                        <SectionCard
                            title="Clinic Information"
                            description="Update your personal information"
                            fields={clinicFields}
                            formData={formData}
                            onChange={handleChange}
                            className="mt-[26px] min-h-[260px]"
                        />

                        <SectionCard
                            title="Change Password"
                            description="Your password must contains numbers, capital letters, special characters"
                            fields={passwordFields}
                            formData={formData}
                            onChange={handleChange}
                            className="mt-[26px] min-h-[170px]"
                        />

                        <button
                            type="submit"
                            className="mt-[26px] h-[34px] px-[22px] rounded-[50px] bg-[#86A789] text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-[#739072]"
                        >
                            Update Changes
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default AccountSetting;