'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import LoadingOverlay from '@/components/loading'
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

type ManagementStats = {
    total_employees: number;
    active_employees: number;
    inactive_employees: number;
    admins: number;
    midwives: number;
    asistens: number;
};

type ManagementOverviewResponse = {
    msg?: string;
    user: Employee;
    clinic: ClinicData | null;
    employees: Employee[];
    stats?: Partial<ManagementStats>;
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

const emptyStats: ManagementStats = {
    total_employees: 0,
    active_employees: 0,
    inactive_employees: 0,
    admins: 0,
    midwives: 0,
    asistens: 0,
};

const inputClassName =
    'mt-[8px] h-[34px] w-full min-w-0 rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

const textAreaClassName =
    'mt-[8px] min-h-[76px] w-full min-w-0 resize-none rounded-[4px] border border-[#BFC7BB] bg-white px-3 py-2 text-[12px] text-black shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

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

const normalizeStats = (
    employees: Employee[],
    stats?: Partial<ManagementStats>,
): ManagementStats => {
    const activeEmployees = employees.filter((employee) => employee.is_active);
    const inactiveEmployees = employees.filter((employee) => !employee.is_active);

    return {
        total_employees: stats?.total_employees ?? employees.length,
        active_employees: stats?.active_employees ?? activeEmployees.length,
        inactive_employees: stats?.inactive_employees ?? inactiveEmployees.length,
        admins:
            stats?.admins ??
            employees.filter((employee) => employee.role === 'admin').length,
        midwives:
            stats?.midwives ??
            employees.filter((employee) => employee.role === 'midwife').length,
        asistens:
            stats?.asistens ??
            employees.filter((employee) => employee.role === 'asisten').length,
    };
};

const ManagementSetting = () => {
    const router = useRouter();

    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
    const [clinic, setClinic] = useState<ClinicData | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [stats, setStats] = useState<ManagementStats>(emptyStats);

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

    const filteredEmployees = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();

        return employees.filter((employee) => {
            const matchesSearch =
                !normalizedSearch ||
                employee.fullname.toLowerCase().includes(normalizedSearch) ||
                employee.email.toLowerCase().includes(normalizedSearch) ||
                formatRole(employee.role).toLowerCase().includes(normalizedSearch) ||
                (employee.strnumber || '').toLowerCase().includes(normalizedSearch);

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

            const response = await fetch(`${API_BASE_URL}/auth/management/overview`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = (await readJson(response)) as ManagementOverviewResponse;

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

            const nextEmployees = data.employees || [];

            setCurrentUser(data.user);
            setClinic(data.clinic);
            setEmployees(nextEmployees);
            setStats(normalizeStats(nextEmployees, data.stats));
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

            const response = await fetch(`${API_BASE_URL}/auth/management/clinic`, {
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
            });

            const data = await readJson(response);

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal memperbarui data klinik');
            }

            setClinic(data.clinic);
            setClinicForm(mapClinicToForm(data.clinic));
            setSuccessMessage('Clinic information berhasil diperbarui');
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

            const response = await fetch(`${API_BASE_URL}/auth/management/users`, {
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
            });

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
        <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#FDFEF9]">
            {isLoading && <LoadingOverlay />}
            <div className="flex min-h-dvh w-full max-w-full overflow-x-hidden">
                <main className="box-border flex min-w-0 flex-1 flex-col overflow-x-hidden pb-[40px] pl-4 pr-0 pt-[26px] sm:pl-[28px] sm:pr-0">
                    <div className="box-border w-full max-w-none min-w-0">
                        <div className="mt-[28px] box-border flex min-h-[118px] w-full max-w-full flex-col gap-[18px] rounded-l-[8px] bg-[#86A789] px-4 py-[24px] shadow-md sm:px-[38px] lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#FDFEF9] opacity-90">
                                    Management Setting
                                </p>

                                <h1 className="mt-[10px] truncate text-[26px] font-bold leading-none text-white">
                                    {clinic?.clinic_name || 'Clinic Management'}
                                </h1>

                                <p className="mt-[10px] text-[12px] font-medium text-white">
                                    Manage clinic information, accounts, roles, and access.
                                </p>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-[12px]">
                                <div className="rounded-[50px] bg-white px-[18px] py-[8px] text-[12px] font-bold text-[#5F785F] shadow-sm">
                                    {formatRole(currentUser?.role || 'admin')}
                                </div>

                                <div className="rounded-[50px] bg-[#D2E3C8] px-[18px] py-[8px] text-[12px] font-bold text-[#4F6F52] shadow-sm">
                                    {stats.total_employees} Users
                                </div>
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
                            <div className="mt-[26px] w-full rounded-l-[8px] border border-[#D2D8CF] bg-white px-[24px] py-[28px] text-[12px] text-black">
                                Loading management setting...
                            </div>
                        ) : (
                            <>
                                <div className="mt-[26px] grid w-full min-w-0 grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-l-[8px] border border-[#D2D8CF] bg-white px-[22px] py-[18px] shadow-sm">
                                        <p className="text-[11px] font-semibold text-[#5F785F]">
                                            Total User
                                        </p>
                                        <h2 className="mt-[8px] text-[26px] font-bold text-black">
                                            {stats.total_employees}
                                        </h2>
                                    </div>

                                    <div className="rounded-[8px] border border-[#D2D8CF] bg-white px-[22px] py-[18px] shadow-sm">
                                        <p className="text-[11px] font-semibold text-[#5F785F]">
                                            Active
                                        </p>
                                        <h2 className="mt-[8px] text-[26px] font-bold text-black">
                                            {stats.active_employees}
                                        </h2>
                                    </div>

                                    <div className="rounded-[8px] border border-[#D2D8CF] bg-white px-[22px] py-[18px] shadow-sm">
                                        <p className="text-[11px] font-semibold text-[#5F785F]">
                                            Midwife
                                        </p>
                                        <h2 className="mt-[8px] text-[26px] font-bold text-black">
                                            {stats.midwives}
                                        </h2>
                                    </div>

                                    <div className="rounded-l-[8px] border border-r-0 border-[#D2D8CF] bg-white px-[22px] py-[18px] shadow-sm">
                                        <p className="text-[11px] font-semibold text-[#5F785F]">
                                            Asisten
                                        </p>
                                        <h2 className="mt-[8px] text-[26px] font-bold text-black">
                                            {stats.asistens}
                                        </h2>
                                    </div>
                                </div>

                                <section className="mt-[26px] box-border w-full rounded-l-[8px] border border-r-0 border-[#D2D8CF] bg-white px-4 py-[26px] shadow-sm sm:px-[30px]">
                                    <h2 className="text-[18px] font-bold leading-none text-black">
                                        User Access
                                    </h2>

                                    <p className="mt-[8px] text-[11px] text-black">
                                        Kelola akun admin, midwife, dan asisten yang terhubung ke klinik.
                                    </p>

                                    <div className="mt-[14px]">
                                        <button
                                            type="button"
                                            onClick={openAccountModal}
                                            className="h-[34px] rounded-[50px] bg-[#86A789] px-[22px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            Add Account
                                        </button>
                                    </div>

                                    <div className="mt-[22px] grid w-full min-w-0 grid-cols-1 gap-[12px] lg:grid-cols-[1fr_180px_180px]">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(event) => setSearchQuery(event.target.value)}
                                            placeholder="Search user by name, email, role, or STR..."
                                            className={inputClassName}
                                        />

                                        <select
                                            value={roleFilter}
                                            onChange={(event) => setRoleFilter(event.target.value)}
                                            className={inputClassName}
                                        >
                                            <option value="all">All Roles</option>
                                            {roleOptions.map((role) => (
                                                <option key={role.value} value={role.value}>
                                                    {role.label}
                                                </option>
                                            ))}
                                        </select>

                                        <select
                                            value={statusFilter}
                                            onChange={(event) => setStatusFilter(event.target.value)}
                                            className={inputClassName}
                                        >
                                            <option value="all">All Status</option>
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>

                                    <div className="mt-[20px] w-full overflow-x-auto rounded-l-[8px] border border-r-0 border-[#E4E8E1]">
                                        <table className="w-full min-w-[900px] divide-y divide-[#E4E8E1] text-[11px]">
                                            <thead className="bg-[#D2E3C8] text-[#3F3F3F]">
                                                <tr>
                                                    <th className="px-5 py-4 text-left">User</th>
                                                    <th className="px-5 py-4 text-left">Email</th>
                                                    <th className="px-5 py-4 text-center">Role</th>
                                                    <th className="px-5 py-4 text-center">Status</th>
                                                    <th className="px-5 py-4 text-center">Last Login</th>
                                                    <th className="px-5 py-4 text-center">Action</th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-[#F0F2EE] bg-white">
                                                {filteredEmployees.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-5 py-8 text-center text-gray-500"
                                                        >
                                                            No user found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredEmployees.map((employee) => (
                                                        <tr key={employee.id} className="text-black">
                                                            <td className="px-5 py-4">
                                                                <div className="flex min-w-0 items-center gap-[12px]">
                                                                    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#D2E3C8] text-[12px] font-bold text-[#4F6F52]">
                                                                        {getInitials(employee.fullname)}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <p className="truncate font-bold">
                                                                            {employee.fullname}
                                                                        </p>
                                                                        <p className="mt-[3px] truncate text-[10px] text-gray-500">
                                                                            STR: {employee.strnumber || '-'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4">{employee.email}</td>

                                                            <td className="px-5 py-4 text-center">
                                                                <span
                                                                    className={`inline-flex min-w-[78px] justify-center rounded-full px-3 py-1 text-[10px] font-bold ${getRoleBadgeClassName(employee.role)}`}
                                                                >
                                                                    {formatRole(employee.role)}
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-4 text-center">
                                                                <span
                                                                    className={`inline-flex min-w-[76px] justify-center rounded-full px-3 py-1 text-[10px] font-bold ${
                                                                        employee.is_active
                                                                            ? 'bg-[#D2E3C8] text-[#4F6F52]'
                                                                            : 'bg-[#F3E8C8] text-[#7A5A00]'
                                                                    }`}
                                                                >
                                                                    {employee.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-4 text-center">
                                                                {formatDateTime(employee.last_login)}
                                                            </td>

                                                            <td className="px-5 py-4 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEmployeeDetail(employee)}
                                                                    className="rounded-[50px] bg-[#86A789] px-[18px] py-[7px] text-[11px] font-bold text-white shadow-sm transition-all hover:bg-[#739072]"
                                                                >
                                                                    Detail
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section className="mt-[26px] box-border w-full rounded-l-[8px] border border-r-0 border-[#D2D8CF] bg-white px-4 py-[26px] shadow-sm sm:px-[30px]">
                                    <h2 className="text-[18px] font-bold leading-none text-black">
                                        Edit Clinic Information
                                    </h2>

                                    <p className="mt-[8px] text-[11px] text-black">
                                        Data ini bersifat global untuk semua user yang terhubung ke klinik.
                                    </p>

                                    <form
                                        onSubmit={handleUpdateClinic}
                                        className="mt-[22px] grid w-full min-w-0 grid-cols-1 gap-x-[42px] gap-y-[14px] md:grid-cols-2"
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
                                                type="tel"
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

                                        <div>
                                            <button
                                                type="submit"
                                                disabled={isSavingClinic}
                                                className="h-[34px] rounded-[50px] bg-[#86A789] px-[22px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
                                            >
                                                {isSavingClinic ? 'Saving...' : 'Save Clinic Changes'}
                                            </button>
                                        </div>
                                    </form>
                                </section>
                            </>
                        )}
                    </div>
                </main>
            </div>

            {isAccountModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
                    <div className="relative box-border w-full max-w-[560px] overflow-hidden rounded-[16px] border border-[#D2E3C8] bg-[#FDFEF9] shadow-2xl">
                        <button
                            type="button"
                            onClick={closeAccountModal}
                            disabled={isCreatingAccount}
                            className="absolute right-[18px] top-[16px] z-10 flex h-[28px] w-[28px] items-center justify-center rounded-full text-[22px] leading-none text-[#2F2F2F] transition-all hover:bg-[#EEF3EA] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Close add account"
                        >
                            ×
                        </button>

                        <div className="bg-white px-[26px] pb-[20px] pt-[30px] text-center">
                            <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#D2E3C8] text-[26px] font-bold text-[#4F6F52] shadow-sm">
                                +
                            </div>

                            <h2 className="mt-[16px] text-[24px] font-bold leading-tight text-[#4F6F52]">
                                Add Account
                            </h2>

                            <p className="mt-[8px] text-[12px] text-[#444444]">
                                Buat akun login baru untuk user klinik.
                            </p>
                        </div>

                        <form onSubmit={handleCreateAccount} className="px-[26px] pb-[26px]">
                            <div className="rounded-[10px] border border-[#E4E8E1] bg-[#F8FAF6] p-[16px]">
                                <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
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
                                                <option key={role.value} value={role.value}>
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
                                            value={accountForm.isActive ? 'active' : 'inactive'}
                                            onChange={handleAccountChange}
                                            className={inputClassName}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </label>
                                </div>
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
                                    {isCreatingAccount ? 'Creating...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
                    <div className="relative box-border w-full max-w-[560px] overflow-hidden rounded-[16px] border border-[#D2E3C8] bg-[#FDFEF9] shadow-2xl">
                        <button
                            type="button"
                            onClick={closeEmployeeDetail}
                            disabled={isSavingEmployee}
                            className="absolute right-[18px] top-[16px] z-10 flex h-[28px] w-[28px] items-center justify-center rounded-full text-[22px] leading-none text-[#2F2F2F] transition-all hover:bg-[#EEF3EA] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Close user detail"
                        >
                            ×
                        </button>

                        <div className="bg-white px-[26px] pb-[20px] pt-[30px] text-center">
                            <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#D2E3C8] text-[26px] font-bold text-[#4F6F52] shadow-sm">
                                {getInitials(selectedEmployee.fullname)}
                            </div>

                            <h2 className="mt-[16px] text-[24px] font-bold leading-tight text-[#4F6F52]">
                                User Detail
                            </h2>

                            <p className="mt-[8px] text-[12px] text-[#444444]">
                                Review account data and update access for this clinic.
                            </p>
                        </div>

                        <div className="px-[26px] pb-[26px]">
                            <div className="rounded-[10px] border border-[#E4E8E1] bg-[#F8FAF6] p-[16px]">
                                <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                            Full Name
                                        </p>
                                        <p className="mt-[5px] text-[13px] font-bold text-black">
                                            {selectedEmployee.fullname}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                            Email
                                        </p>
                                        <p className="mt-[5px] break-all text-[13px] font-bold text-black">
                                            {selectedEmployee.email}
                                        </p>
                                    </div>

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
                                            {formatDateTime(selectedEmployee.created_at)}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                            Last Login
                                        </p>
                                        <p className="mt-[5px] text-[13px] font-bold text-black">
                                            {formatDateTime(selectedEmployee.last_login)}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                            Current Status
                                        </p>
                                        <p className="mt-[5px] text-[13px] font-bold text-black">
                                            {selectedEmployee.is_active ? 'Active' : 'Inactive'}
                                        </p>
                                    </div>
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
                                            setSelectedRole(event.target.value as Role)
                                        }
                                        disabled={selectedEmployee.is_current_user || isSavingEmployee}
                                        className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-70`}
                                    >
                                        {roleOptions.map((role) => (
                                            <option key={role.value} value={role.value}>
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block">
                                    <span className="text-[11px] font-bold text-black">
                                        Account Status
                                    </span>
                                    <select
                                        value={selectedIsActive ? 'active' : 'inactive'}
                                        onChange={(event) =>
                                            setSelectedIsActive(event.target.value === 'active')
                                        }
                                        disabled={selectedEmployee.is_current_user || isSavingEmployee}
                                        className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-70`}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </label>
                            </div>

                            {selectedEmployee.is_current_user && (
                                <p className="mt-[12px] rounded-[6px] bg-[#F3E8C8] px-[12px] py-[8px] text-[11px] font-semibold text-[#7A5A00]">
                                    You cannot change your own role or deactivate yourself.
                                </p>
                            )}

                            <div className="mt-[22px] flex flex-col-reverse gap-[10px] sm:flex-row sm:items-center sm:justify-between">
                                <button
                                    type="button"
                                    onClick={openDeleteModal}
                                    disabled={selectedEmployee.is_current_user || isSavingEmployee}
                                    className="h-[36px] rounded-[50px] border border-red-200 bg-white px-[18px] text-[12px] font-bold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Remove from Clinic
                                </button>

                                <div className="flex items-center justify-end gap-[10px]">
                                    <button
                                        type="button"
                                        onClick={closeEmployeeDetail}
                                        disabled={isSavingEmployee}
                                        className="h-[36px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-black transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Close
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSaveEmployee}
                                        disabled={selectedEmployee.is_current_user || isSavingEmployee}
                                        className="h-[36px] rounded-[50px] bg-[#86A789] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSavingEmployee ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-6">
                    <div className="relative box-border w-full max-w-[460px] overflow-hidden rounded-[18px] border border-red-100 bg-[#FDFEF9] shadow-2xl">
                        <button
                            type="button"
                            onClick={closeDeleteModal}
                            disabled={isSavingEmployee}
                            className="absolute right-[18px] top-[16px] z-10 flex h-[28px] w-[28px] items-center justify-center rounded-full text-[22px] leading-none text-[#2F2F2F] transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Close delete confirmation"
                        >
                            ×
                        </button>

                        <div className="bg-white px-[26px] pb-[20px] pt-[30px] text-center">
                            <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-red-50 text-[30px] font-bold text-red-600 shadow-sm">
                                !
                            </div>

                            <h2 className="mt-[16px] text-[23px] font-bold leading-tight text-red-600">
                                Hapus Akses User?
                            </h2>

                            <p className="mt-[8px] text-[12px] leading-relaxed text-[#444444]">
                                Apakah kamu yakin ingin menghapus akses akun ini dari klinik?
                            </p>
                        </div>

                        <div className="px-[26px] pb-[26px]">
                            <div className="rounded-[10px] border border-red-100 bg-red-50 px-[16px] py-[14px]">
                                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-red-600">
                                    User yang akan dihapus
                                </p>

                                <p className="mt-[8px] text-[14px] font-bold text-black">
                                    {selectedEmployee.fullname}
                                </p>

                                <p className="mt-[4px] break-all text-[12px] font-medium text-[#5F5F5F]">
                                    {selectedEmployee.email}
                                </p>

                                <p className="mt-[8px] text-[11px] font-semibold text-red-600">
                                    Akun akan dinonaktifkan dan dilepas dari klinik. Data audit tetap tersimpan.
                                </p>
                            </div>

                            <div className="mt-[22px] flex flex-col-reverse gap-[10px] sm:flex-row sm:items-center sm:justify-end">
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
                                    className="h-[36px] rounded-[50px] bg-red-600 px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSavingEmployee ? 'Removing...' : 'Yes, Remove User'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagementSetting;