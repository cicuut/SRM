'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import LoadingOverlay from '@/components/loading';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type Role = 'admin' | 'midwife' | 'asisten';

type ClinicData = {
    id: string;
    clinic_name: string;
    clinic_address: string;
    license_number: string;
    clinic_email: string;
    clinic_phone: string;
};

type Employee = {
    id: string;
    fullname: string;
    email: string;
    role: Role;
    strnumber?: string | null;
    clinic_id?: string | null;
    is_active: boolean;
    created_at?: string | null;
    last_login?: string | null;
    is_current_user?: boolean;
};

type ManagementOverviewResponse = {
    msg?: string;
    user: Employee;
    clinic: ClinicData | null;
    employees: Employee[];
};

type ClinicFormData = {
    clinicName: string;
    sipbNo: string;
    clinicAddress: string;
    clinicPhoneNumber: string;
    clinicEmail: string;
};

type AccountFormData = {
    fullname: string;
    email: string;
    password: string;
    confirmPassword: string;
    strnumber: string;
    role: Role;
    isActive: boolean;
};

const roleOptions: Array<{ value: Role; label: string }> = [
    {
        value: 'admin',
        label: 'Admin',
    },
    {
        value: 'midwife',
        label: 'Midwife',
    },
    {
        value: 'asisten',
        label: 'Asisten',
    },
];

const emptyClinicForm: ClinicFormData = {
    clinicName: '',
    sipbNo: '',
    clinicAddress: '',
    clinicPhoneNumber: '',
    clinicEmail: '',
};

const emptyAccountForm: AccountFormData = {
    fullname: '',
    email: '',
    password: '',
    confirmPassword: '',
    strnumber: '',
    role: 'asisten',
    isActive: true,
};

const inputClassName =
    'mt-[8px] h-[34px] w-full min-w-0 rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072] disabled:cursor-not-allowed disabled:bg-[#F8FAF6] disabled:opacity-70';

const textAreaClassName =
    'mt-[8px] min-h-[76px] w-full min-w-0 resize-none rounded-[4px] border border-[#BFC7BB] bg-white px-3 py-2 text-[12px] text-black shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072] disabled:cursor-not-allowed disabled:bg-[#F8FAF6] disabled:opacity-70';

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const formatRole = (role: string) => {
    if (role === 'asisten') return 'Asisten';
    if (!role) return '-';

    return role.charAt(0).toUpperCase() + role.slice(1);
};

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
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

const mapClinicToForm = (clinic: ClinicData | null): ClinicFormData => {
    if (!clinic) {
        return emptyClinicForm;
    }

    return {
        clinicName: clinic.clinic_name || '',
        sipbNo: clinic.license_number || '',
        clinicAddress: clinic.clinic_address || '',
        clinicPhoneNumber: clinic.clinic_phone || '',
        clinicEmail: clinic.clinic_email || '',
    };
};

const getRoleBadgeClassName = (role: string) => {
    if (role === 'admin') {
        return 'bg-[#D2E3C8] text-[#3F5E42]';
    }

    if (role === 'midwife') {
        return 'bg-[#E6EFD8] text-[#5F785F]';
    }

    return 'bg-[#F2F2F2] text-[#5F5F5F]';
};

const ManagementSetting = () => {
    const router = useRouter();

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [clinicForm, setClinicForm] =
        useState<ClinicFormData>(emptyClinicForm);
    const [accountForm, setAccountForm] =
        useState<AccountFormData>(emptyAccountForm);

    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const [selectedEmployee, setSelectedEmployee] =
        useState<Employee | null>(null);
    const [selectedRole, setSelectedRole] = useState<Role>('asisten');
    const [selectedIsActive, setSelectedIsActive] = useState(true);

    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [isSavingClinic, setIsSavingClinic] = useState(false);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [isSavingEmployee, setIsSavingEmployee] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const showLoadingOverlay =
        isLoading || isSavingClinic || isCreatingAccount || isSavingEmployee;

    const filteredEmployees = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();

        return employees.filter((employee) => {
            const matchesSearch =
                !normalizedSearch ||
                employee.fullname.toLowerCase().includes(normalizedSearch) ||
                employee.email.toLowerCase().includes(normalizedSearch) ||
                formatRole(employee.role)
                    .toLowerCase()
                    .includes(normalizedSearch) ||
                (employee.strnumber || '')
                    .toLowerCase()
                    .includes(normalizedSearch);

            const matchesRole =
                roleFilter === 'all' || employee.role === roleFilter;

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && employee.is_active) ||
                (statusFilter === 'inactive' && !employee.is_active);

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [employees, searchQuery, roleFilter, statusFilter]);

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

        router.push('/login');
    };

    const fetchOverview = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/auth/management/overview`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            const data =
                (await readJson(response)) as ManagementOverviewResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                router.push('/dashboard');
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal mengambil data management');
            }

            setEmployees(data.employees || []);
            setClinicForm(mapClinicToForm(data.clinic));
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil data management';

            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOverview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClinicChange = (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        const fieldName = event.target.name as keyof ClinicFormData;
        const { value } = event.target;

        setClinicForm((prevData) => ({
            ...prevData,
            [fieldName]: value,
        }));
    };

    const handleAccountChange = (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const fieldName = event.target.name as keyof AccountFormData;
        const { value } = event.target;

        if (fieldName === 'isActive') {
            setAccountForm((prevData) => ({
                ...prevData,
                isActive: value === 'active',
            }));

            return;
        }

        if (fieldName === 'role') {
            setAccountForm((prevData) => ({
                ...prevData,
                role: value as Role,
            }));

            return;
        }

        setAccountForm((prevData) => ({
            ...prevData,
            [fieldName]: value,
        }));
    };

    const validateClinicForm = () => {
        if (!clinicForm.clinicName.trim()) {
            return 'Clinic name wajib diisi';
        }

        if (!clinicForm.sipbNo.trim()) {
            return 'SIPB No wajib diisi';
        }

        if (!clinicForm.clinicEmail.trim()) {
            return 'Clinic email wajib diisi';
        }

        if (!clinicForm.clinicPhoneNumber.trim()) {
            return 'Clinic phone number wajib diisi';
        }

        if (!clinicForm.clinicAddress.trim()) {
            return 'Clinic address wajib diisi';
        }

        return '';
    };

    const validateAccountForm = () => {
        if (!accountForm.fullname.trim()) {
            return 'Full name wajib diisi';
        }

        if (!accountForm.email.trim()) {
            return 'Email wajib diisi';
        }

        if (!accountForm.email.includes('@')) {
            return 'Format email tidak valid';
        }

        if (!accountForm.password || accountForm.password.length < 8) {
            return 'Password minimal 8 karakter';
        }

        if (accountForm.password !== accountForm.confirmPassword) {
            return 'Confirm password tidak sama';
        }

        return '';
    };

    const openAccountModal = () => {
        setAccountForm(emptyAccountForm);
        setErrorMessage('');
        setSuccessMessage('');
        setIsAccountModalOpen(true);
    };

    const closeAccountModal = () => {
        if (isCreatingAccount) return;

        setIsAccountModalOpen(false);
        setAccountForm(emptyAccountForm);
    };

    const handleUpdateClinic = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setIsSavingClinic(true);
            setErrorMessage('');
            setSuccessMessage('');

            const validationMessage = validateClinicForm();

            if (validationMessage) {
                setErrorMessage(validationMessage);
                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/auth/management/clinic`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        clinic_name: clinicForm.clinicName.trim(),
                        license_number: clinicForm.sipbNo.trim(),
                        clinic_email: clinicForm.clinicEmail.trim(),
                        clinic_phone: clinicForm.clinicPhoneNumber.trim(),
                        clinic_address: clinicForm.clinicAddress.trim(),
                    }),
                },
            );

            const data = await readJson(response);

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal memperbarui data klinik');
            }

            setClinicForm(mapClinicToForm(data.clinic));
            setSuccessMessage('Clinic information berhasil diperbarui');

            window.location.reload();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat memperbarui data klinik';

            setErrorMessage(message);
        } finally {
            setIsSavingClinic(false);
        }
    };

    const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setIsCreatingAccount(true);
            setErrorMessage('');
            setSuccessMessage('');

            const validationMessage = validateAccountForm();

            if (validationMessage) {
                setErrorMessage(validationMessage);
                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/auth/management/users`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fullname: accountForm.fullname.trim(),
                        email: accountForm.email.trim(),
                        password: accountForm.password,
                        strnumber: accountForm.strnumber.trim(),
                        role: accountForm.role,
                        is_active: accountForm.isActive,
                    }),
                },
            );

            const data = await readJson(response);

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal membuat akun user');
            }

            setAccountForm(emptyAccountForm);
            setIsAccountModalOpen(false);
            setSuccessMessage('Akun user berhasil dibuat');
            await fetchOverview();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat membuat akun user';

            setErrorMessage(message);
        } finally {
            setIsCreatingAccount(false);
        }
    };

    const openEmployeeDetail = (employee: Employee) => {
        setSelectedEmployee(employee);
        setSelectedRole(employee.role || 'asisten');
        setSelectedIsActive(Boolean(employee.is_active));
        setIsDeleteModalOpen(false);
        setErrorMessage('');
        setSuccessMessage('');
    };

    const closeEmployeeDetail = () => {
        if (isSavingEmployee) return;

        setIsDeleteModalOpen(false);
        setSelectedEmployee(null);
    };

    const openDeleteModal = () => {
        if (!selectedEmployee) return;

        setErrorMessage('');
        setSuccessMessage('');
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        if (isSavingEmployee) return;

        setIsDeleteModalOpen(false);
    };

    const handleSaveEmployee = async () => {
        if (!selectedEmployee) return;

        try {
            setIsSavingEmployee(true);
            setErrorMessage('');
            setSuccessMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/auth/management/employees/${selectedEmployee.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        role: selectedRole,
                        is_active: selectedIsActive,
                    }),
                },
            );

            const data = await readJson(response);

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal memperbarui user');
            }

            setSelectedEmployee(data.employee);
            setSuccessMessage('User berhasil diperbarui');
            await fetchOverview();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat memperbarui user';

            setErrorMessage(message);
        } finally {
            setIsSavingEmployee(false);
        }
    };

    const handleRemoveEmployee = async () => {
        if (!selectedEmployee) return;

        try {
            setIsSavingEmployee(true);
            setErrorMessage('');
            setSuccessMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/auth/management/employees/${selectedEmployee.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            const data = await readJson(response);

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 400 || response.status === 403) {
                throw new Error(data?.msg || 'User ini tidak bisa dihapus');
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal menghapus user');
            }

            setIsDeleteModalOpen(false);
            setSelectedEmployee(null);
            setSuccessMessage('User berhasil dinonaktifkan dan dilepas dari klinik');
            await fetchOverview();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat menghapus user';

            setErrorMessage(message);
        } finally {
            setIsSavingEmployee(false);
        }
    };

    return (
        <>
            {showLoadingOverlay && <LoadingOverlay />}

            <div className="box-border flex w-full max-w-none min-w-0 flex-col gap-5">
                {errorMessage && (
                    <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="rounded-[10px] border border-green-200 bg-green-50 px-4 py-3 text-[12px] font-medium text-green-700">
                        {successMessage}
                    </div>
                )}

                {isLoading ? (
                    <div className="rounded-[22px] border border-[#D2D8CF] bg-white px-6 py-8 text-[13px] font-semibold text-[#4F6F52] shadow-sm">
                        Loading management setting...
                    </div>
                ) : (
                    <>
                        <section className="overflow-hidden rounded-[22px] border border-[#D2D8CF] bg-white shadow-sm">
                            <div className="flex flex-col gap-4 border-b border-[#E4E8E1] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                                        User Access
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={openAccountModal}
                                    className="flex min-h-[38px] items-center justify-center rounded-[50px] bg-[#86A789] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    Add Account
                                </button>
                            </div>

                            <div className="px-5 py-5 sm:px-6">
                                <div className="grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_180px_180px]">
                                    <div className="relative min-w-0 rounded-[50px] border border-[#D2D8CF] bg-[#FDFEF9] px-5 py-[11px] shadow-sm transition-all focus-within:border-[#739072]">
                                        <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[14px] text-gray-400">
                                            ⌕
                                        </span>

                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(event) =>
                                                setSearchQuery(event.target.value)
                                            }
                                            placeholder="Search user by name, email, role, or STR..."
                                            className="w-full bg-transparent pl-8 text-[13px] text-gray-700 outline-none placeholder-gray-400"
                                        />
                                    </div>

                                    <div className="flex h-[40px] items-center justify-center whitespace-nowrap rounded-[50px] bg-[#D2E3C8] px-5 text-[12px] font-bold text-[#4F6F52] shadow-sm">
                                        {employees.length} User
                                    </div>

                                    <select
                                        value={roleFilter}
                                        onChange={(event) =>
                                            setRoleFilter(event.target.value)
                                        }
                                        className="h-[40px] rounded-[50px] border border-[#D2D8CF] bg-white px-4 text-[12px] font-bold text-[#4B4B4B] shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                    >
                                        <option value="all">All Roles</option>
                                        {roleOptions.map((role) => (
                                            <option
                                                key={role.value}
                                                value={role.value}
                                            >
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={statusFilter}
                                        onChange={(event) =>
                                            setStatusFilter(event.target.value)
                                        }
                                        className="h-[40px] rounded-[50px] border border-[#D2D8CF] bg-white px-4 text-[12px] font-bold text-[#4B4B4B] shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>

                                <div className="mt-5 hidden w-full overflow-x-auto rounded-[16px] border border-[#E4E8E1] lg:block">
                                    <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[12px]">
                                        <thead>
                                            <tr className="bg-[#D2E3C8] text-center text-[10px] font-bold uppercase text-[#3F3F3F]">
                                                <th className="px-5 py-4 text-left">
                                                    User
                                                </th>
                                                <th className="px-5 py-4">
                                                    Role
                                                </th>
                                                <th className="px-5 py-4">
                                                    Status
                                                </th>
                                                <th className="px-5 py-4">
                                                    Last Login
                                                </th>
                                                <th className="px-5 py-4">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-[#F0F2EE] bg-white">
                                            {filteredEmployees.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        className="px-5 py-10 text-center text-[13px] text-gray-500"
                                                    >
                                                        No user found
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredEmployees.map(
                                                    (employee) => (
                                                        <tr
                                                            key={employee.id}
                                                            className="text-center text-black transition-all hover:bg-[#F8FAF6]"
                                                        >
                                                            <td className="px-5 py-4 text-left">
                                                                <div className="flex min-w-0 items-center gap-3">
                                                                    <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#D2E3C8] text-[12px] font-bold text-[#4F6F52]">
                                                                        {getInitials(
                                                                            employee.fullname,
                                                                        )}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-[13px] font-bold">
                                                                            {
                                                                                employee.fullname
                                                                            }
                                                                        </p>
                                                                        <p className="mt-[3px] truncate text-[11px] text-gray-500">
                                                                            {
                                                                                employee.email
                                                                            }
                                                                        </p>
                                                                        <p className="mt-[2px] truncate text-[10px] text-gray-400">
                                                                            STR:{' '}
                                                                            {employee.strnumber ||
                                                                                '-'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <span
                                                                    className={`inline-flex min-w-[78px] justify-center rounded-full px-3 py-1 text-[10px] font-bold ${getRoleBadgeClassName(
                                                                        employee.role,
                                                                    )}`}
                                                                >
                                                                    {formatRole(
                                                                        employee.role,
                                                                    )}
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <span
                                                                    className={`inline-flex min-w-[76px] justify-center rounded-full px-3 py-1 text-[10px] font-bold ${
                                                                        employee.is_active
                                                                            ? 'bg-[#D2E3C8] text-[#4F6F52]'
                                                                            : 'bg-[#F3E8C8] text-[#7A5A00]'
                                                                    }`}
                                                                >
                                                                    {employee.is_active
                                                                        ? 'Active'
                                                                        : 'Inactive'}
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-4 text-[#4B4B4B]">
                                                                {formatDateTime(
                                                                    employee.last_login,
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        openEmployeeDetail(
                                                                            employee,
                                                                        )
                                                                    }
                                                                    className="rounded-[50px] bg-[#86A789] px-[18px] py-[7px] text-[11px] font-bold text-white shadow-sm transition-all hover:bg-[#739072]"
                                                                >
                                                                    Detail
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ),
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-5 grid grid-cols-1 gap-3 lg:hidden">
                                    {filteredEmployees.length === 0 ? (
                                        <div className="rounded-[16px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[13px] text-gray-500">
                                            No user found
                                        </div>
                                    ) : (
                                        filteredEmployees.map((employee) => (
                                            <button
                                                key={employee.id}
                                                type="button"
                                                onClick={() =>
                                                    openEmployeeDetail(employee)
                                                }
                                                className="rounded-[16px] border border-[#E4E8E1] bg-white px-4 py-4 text-left shadow-sm transition-all hover:border-[#86A789] hover:bg-[#F8FAF6]"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#D2E3C8] text-[12px] font-bold text-[#4F6F52]">
                                                        {getInitials(
                                                            employee.fullname,
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-[13px] font-bold text-black">
                                                            {employee.fullname}
                                                        </p>
                                                        <p className="mt-1 truncate text-[11px] text-gray-500">
                                                            {employee.email}
                                                        </p>

                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <span
                                                                className={`rounded-full px-3 py-1 text-[10px] font-bold ${getRoleBadgeClassName(
                                                                    employee.role,
                                                                )}`}
                                                            >
                                                                {formatRole(
                                                                    employee.role,
                                                                )}
                                                            </span>

                                                            <span
                                                                className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                                                                    employee.is_active
                                                                        ? 'bg-[#D2E3C8] text-[#4F6F52]'
                                                                        : 'bg-[#F3E8C8] text-[#7A5A00]'
                                                                }`}
                                                            >
                                                                {employee.is_active
                                                                    ? 'Active'
                                                                    : 'Inactive'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[22px] border border-[#D2D8CF] bg-white px-5 py-5 shadow-sm sm:px-6">
                            <div className="border-b border-[#E4E8E1] pb-4">
                                <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                                    Clinic Information
                                </h2>
                            </div>

                            <form
                                onSubmit={handleUpdateClinic}
                                className="mt-5 grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2"
                            >
                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Clinic Name
                                    </span>
                                    <input
                                        type="text"
                                        name="clinicName"
                                        value={clinicForm.clinicName}
                                        onChange={handleClinicChange}
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        SIPB No
                                    </span>
                                    <input
                                        type="text"
                                        name="sipbNo"
                                        value={clinicForm.sipbNo}
                                        onChange={handleClinicChange}
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Clinic Email
                                    </span>
                                    <input
                                        type="email"
                                        name="clinicEmail"
                                        value={clinicForm.clinicEmail}
                                        onChange={handleClinicChange}
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Clinic Phone Number
                                    </span>
                                    <input
                                        type="text"
                                        name="clinicPhoneNumber"
                                        value={clinicForm.clinicPhoneNumber}
                                        onChange={handleClinicChange}
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0 md:col-span-2">
                                    <span className="text-[11px] font-bold text-black">
                                        Clinic Address
                                    </span>
                                    <textarea
                                        name="clinicAddress"
                                        value={clinicForm.clinicAddress}
                                        onChange={handleClinicChange}
                                        className={textAreaClassName}
                                    />
                                </label>

                                <div className="flex justify-end md:col-span-2">
                                    <button
                                        type="submit"
                                        disabled={isSavingClinic}
                                        className="h-[38px] rounded-[50px] bg-[#86A789] px-[22px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSavingClinic
                                            ? 'Saving...'
                                            : 'Update Clinic'}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </>
                )}
            </div>

            {isAccountModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
                    <div className="relative box-border w-full max-w-[620px] overflow-hidden rounded-[18px] border border-[#D2E3C8] bg-white shadow-2xl">
                        <button
                            type="button"
                            onClick={closeAccountModal}
                            disabled={isCreatingAccount}
                            className="absolute right-[18px] top-[16px] z-10 flex h-[28px] w-[28px] items-center justify-center rounded-full text-[22px] leading-none text-[#2F2F2F] transition-all hover:bg-[#EEF3EA] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Close add account modal"
                        >
                            ×
                        </button>

                        <div className="border-b border-[#E4E8E1] px-[26px] py-[22px]">
                            <h2 className="text-[22px] font-bold leading-tight text-[#4F6F52]">
                                Add Account
                            </h2>
                            <p className="mt-1 text-[12px] text-[#6B6B6B]">
                                Buat akun baru untuk akses user klinik.
                            </p>
                        </div>

                        <form
                            onSubmit={handleCreateAccount}
                            className="px-[26px] py-[24px]"
                        >
                            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Full Name
                                    </span>
                                    <input
                                        type="text"
                                        name="fullname"
                                        value={accountForm.fullname}
                                        onChange={handleAccountChange}
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Email
                                    </span>
                                    <input
                                        type="email"
                                        name="email"
                                        value={accountForm.email}
                                        onChange={handleAccountChange}
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        STR Number
                                    </span>
                                    <input
                                        type="text"
                                        name="strnumber"
                                        value={accountForm.strnumber}
                                        onChange={handleAccountChange}
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Role
                                    </span>
                                    <select
                                        name="role"
                                        value={accountForm.role}
                                        onChange={handleAccountChange}
                                        className={inputClassName}
                                    >
                                        {roleOptions.map((role) => (
                                            <option
                                                key={role.value}
                                                value={role.value}
                                            >
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Password
                                    </span>
                                    <input
                                        type="password"
                                        name="password"
                                        value={accountForm.password}
                                        onChange={handleAccountChange}
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Confirm Password
                                    </span>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={accountForm.confirmPassword}
                                        onChange={handleAccountChange}
                                        className={inputClassName}
                                    />
                                </label>

                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Status
                                    </span>
                                    <select
                                        name="isActive"
                                        value={
                                            accountForm.isActive
                                                ? 'active'
                                                : 'inactive'
                                        }
                                        onChange={handleAccountChange}
                                        className={inputClassName}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </label>
                            </div>

                            <div className="mt-[22px] flex items-center justify-end gap-[10px]">
                                <button
                                    type="button"
                                    onClick={closeAccountModal}
                                    disabled={isCreatingAccount}
                                    className="h-[36px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-black transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={isCreatingAccount}
                                    className="h-[36px] rounded-[50px] bg-[#86A789] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isCreatingAccount
                                        ? 'Creating...'
                                        : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
                    <div className="relative box-border w-full max-w-[560px] overflow-hidden rounded-[18px] border border-[#D2E3C8] bg-white shadow-2xl">
                        <button
                            type="button"
                            onClick={closeEmployeeDetail}
                            disabled={isSavingEmployee}
                            className="absolute right-[18px] top-[16px] z-10 flex h-[28px] w-[28px] items-center justify-center rounded-full text-[22px] leading-none text-[#2F2F2F] transition-all hover:bg-[#EEF3EA] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Close user detail"
                        >
                            ×
                        </button>

                        <div className="border-b border-[#E4E8E1] px-[26px] py-[22px]">
                            <div className="flex items-start gap-4">
                                <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-[#D2E3C8] text-[20px] font-bold text-[#4F6F52] shadow-sm">
                                    {getInitials(selectedEmployee.fullname)}
                                </div>

                                <div className="min-w-0 pr-8">
                                    <h2 className="truncate text-[22px] font-bold leading-tight text-[#4F6F52]">
                                        {selectedEmployee.fullname}
                                    </h2>

                                    <p className="mt-1 break-all text-[12px] font-medium text-[#5F5F5F]">
                                        {selectedEmployee.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="px-[26px] py-[24px]">
                            <div className="grid grid-cols-1 gap-[12px] rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] p-[16px] sm:grid-cols-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                        STR Number
                                    </p>
                                    <p className="mt-[5px] text-[13px] font-bold text-black">
                                        {selectedEmployee.strnumber || '-'}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                        Joined
                                    </p>
                                    <p className="mt-[5px] text-[13px] font-bold text-black">
                                        {formatDateTime(
                                            selectedEmployee.created_at,
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                        Last Login
                                    </p>
                                    <p className="mt-[5px] text-[13px] font-bold text-black">
                                        {formatDateTime(
                                            selectedEmployee.last_login,
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-[18px] grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                                <label className="block">
                                    <span className="text-[11px] font-bold text-black">
                                        Role
                                    </span>
                                    <select
                                        value={selectedRole}
                                        onChange={(event) =>
                                            setSelectedRole(
                                                event.target.value as Role,
                                            )
                                        }
                                        disabled={isSavingEmployee}
                                        className={inputClassName}
                                    >
                                        {roleOptions.map((role) => (
                                            <option
                                                key={role.value}
                                                value={role.value}
                                            >
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-[11px] font-bold text-black">
                                        Status
                                    </span>
                                    <select
                                        value={
                                            selectedIsActive
                                                ? 'active'
                                                : 'inactive'
                                        }
                                        onChange={(event) =>
                                            setSelectedIsActive(
                                                event.target.value === 'active',
                                            )
                                        }
                                        disabled={isSavingEmployee}
                                        className={inputClassName}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </label>
                            </div>

                            <div className="mt-[24px] flex flex-col-reverse gap-[10px] sm:flex-row sm:items-center sm:justify-between">
                                <button
                                    type="button"
                                    onClick={openDeleteModal}
                                    disabled={
                                        isSavingEmployee ||
                                        selectedEmployee.is_current_user
                                    }
                                    className="h-[36px] rounded-[50px] border border-red-200 bg-white px-[18px] text-[12px] font-bold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Remove User
                                </button>

                                <div className="flex flex-col-reverse gap-[10px] sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={closeEmployeeDetail}
                                        disabled={isSavingEmployee}
                                        className="h-[36px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-black transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSaveEmployee}
                                        disabled={isSavingEmployee}
                                        className="h-[36px] rounded-[50px] bg-[#86A789] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSavingEmployee
                                            ? 'Saving...'
                                            : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-[420px] rounded-[18px] bg-white px-6 py-6 shadow-2xl">
                        <h2 className="text-[20px] font-bold text-[#2F3A2F]">
                            Remove User?
                        </h2>

                        <p className="mt-3 text-[13px] leading-relaxed text-[#4B4B4B]">
                            User{' '}
                            <span className="font-bold">
                                {selectedEmployee.fullname}
                            </span>{' '}
                            akan dinonaktifkan dan dilepas dari klinik.
                        </p>

                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={isSavingEmployee}
                                className="h-[36px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-black transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleRemoveEmployee}
                                disabled={isSavingEmployee}
                                className="h-[36px] rounded-[50px] bg-red-600 px-[18px] text-[12px] font-bold text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSavingEmployee ? 'Removing...' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ManagementSetting;