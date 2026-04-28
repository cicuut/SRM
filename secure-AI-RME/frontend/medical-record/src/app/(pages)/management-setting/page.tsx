'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '@/components/sidebar';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
    role: string;
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
    owners: number;
    admins: number;
    midwives: number;
    staff: number;
};

type ManagementOverviewResponse = {
    msg?: string;
    user: Employee;
    clinic: ClinicData | null;
    employees: Employee[];
    stats: ManagementStats;
};

type ClinicFormData = {
    clinicName: string;
    sipbNo: string;
    clinicAddress: string;
    clinicPhoneNumber: string;
    clinicEmail: string;
};

type LinkEmployeeFormData = {
    email: string;
    role: string;
};

type ClinicFieldConfig = {
    label: string;
    name: keyof ClinicFormData;
    type?: string;
    fullWidth?: boolean;
    multiline?: boolean;
};

const roleOptions = [
    {
        value: 'owner',
        label: 'Owner',
    },
    {
        value: 'admin',
        label: 'Admin',
    },
    {
        value: 'midwife',
        label: 'Midwife',
    },
    {
        value: 'staff',
        label: 'Staff',
    },
];

const emptyClinicForm: ClinicFormData = {
    clinicName: '',
    sipbNo: '',
    clinicAddress: '',
    clinicPhoneNumber: '',
    clinicEmail: '',
};

const emptyLinkForm: LinkEmployeeFormData = {
    email: '',
    role: 'staff',
};

const inputClassName =
    'mt-[8px] min-h-[34px] w-full min-w-0 box-border rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

const selectClassName =
    'mt-[8px] h-[34px] w-full min-w-0 box-border rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

const clinicFields: ClinicFieldConfig[] = [
    {
        label: 'Clinic Name',
        name: 'clinicName',
    },
    {
        label: 'SIPB No',
        name: 'sipbNo',
    },
    {
        label: 'Clinic Email',
        name: 'clinicEmail',
        type: 'email',
    },
    {
        label: 'Clinic Phone Number',
        name: 'clinicPhoneNumber',
        type: 'tel',
    },
    {
        label: 'Clinic Address',
        name: 'clinicAddress',
        fullWidth: true,
        multiline: true,
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

    return role
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
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
    switch (role) {
        case 'owner':
            return 'bg-[#D2E3C8] text-[#3F5E42]';
        case 'admin':
            return 'bg-[#E6EFD8] text-[#5F785F]';
        case 'midwife':
            return 'bg-[#F3F7EF] text-[#4F6F52]';
        default:
            return 'bg-[#F2F2F2] text-[#5F5F5F]';
    }
};

const ManagementSetting = () => {
    const router = useRouter();

    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
    const [clinic, setClinic] = useState<ClinicData | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [stats, setStats] = useState<ManagementStats>({
        total_employees: 0,
        active_employees: 0,
        inactive_employees: 0,
        owners: 0,
        admins: 0,
        midwives: 0,
        staff: 0,
    });

    const [clinicForm, setClinicForm] =
        useState<ClinicFormData>(emptyClinicForm);
    const [linkForm, setLinkForm] =
        useState<LinkEmployeeFormData>(emptyLinkForm);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');

    const [selectedEmployee, setSelectedEmployee] =
        useState<Employee | null>(null);
    const [selectedRole, setSelectedRole] = useState('staff');
    const [selectedIsActive, setSelectedIsActive] = useState(true);

    const [isLoading, setIsLoading] = useState(true);
    const [isSavingClinic, setIsSavingClinic] = useState(false);
    const [isLinkingEmployee, setIsLinkingEmployee] = useState(false);
    const [isSavingEmployee, setIsSavingEmployee] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const isOwner = currentUser?.role === 'owner';

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

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && employee.is_active) ||
                (statusFilter === 'inactive' && !employee.is_active);

            const matchesRole =
                roleFilter === 'all' || employee.role === roleFilter;

            return matchesSearch && matchesStatus && matchesRole;
        });
    }, [employees, searchQuery, statusFilter, roleFilter]);

    const getToken = () => {
        return Cookies.get('access_token');
    };

    const handleUnauthorized = () => {
        Cookies.remove('access_token');
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

            const data = (await readJson(response)) as ManagementOverviewResponse;

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(
                    data?.msg || 'Gagal mengambil data management setting',
                );
            }

            setCurrentUser(data.user);
            setClinic(data.clinic);
            setEmployees(data.employees || []);
            setStats(
                data.stats || {
                    total_employees: data.employees?.length || 0,
                    active_employees:
                        data.employees?.filter((employee) => employee.is_active)
                            .length || 0,
                    inactive_employees:
                        data.employees?.filter(
                            (employee) => !employee.is_active,
                        ).length || 0,
                    owners:
                        data.employees?.filter(
                            (employee) => employee.role === 'owner',
                        ).length || 0,
                    admins:
                        data.employees?.filter(
                            (employee) => employee.role === 'admin',
                        ).length || 0,
                    midwives:
                        data.employees?.filter(
                            (employee) => employee.role === 'midwife',
                        ).length || 0,
                    staff:
                        data.employees?.filter(
                            (employee) => employee.role === 'staff',
                        ).length || 0,
                },
            );
            setClinicForm(mapClinicToForm(data.clinic));
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil data management setting';

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

    const handleLinkFormChange = (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const fieldName = event.target.name as keyof LinkEmployeeFormData;
        const { value } = event.target;

        setLinkForm((prevData) => ({
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

            if (response.status === 401) {
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

    const handleLinkEmployee = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setIsLinkingEmployee(true);
            setErrorMessage('');
            setSuccessMessage('');

            if (!linkForm.email.trim()) {
                setErrorMessage('Email employee wajib diisi');
                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/auth/management/employees/link`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: linkForm.email.trim(),
                        role: linkForm.role,
                    }),
                },
            );

            const data = await readJson(response);

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal menambahkan employee');
            }

            setLinkForm(emptyLinkForm);
            setSuccessMessage('Employee berhasil dihubungkan ke klinik');
            await fetchOverview();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat menambahkan employee';

            setErrorMessage(message);
        } finally {
            setIsLinkingEmployee(false);
        }
    };

    const openEmployeeDetail = (employee: Employee) => {
        setSelectedEmployee(employee);
        setSelectedRole(employee.role || 'staff');
        setSelectedIsActive(Boolean(employee.is_active));
        setErrorMessage('');
        setSuccessMessage('');
    };

    const closeEmployeeDetail = () => {
        if (isSavingEmployee) return;

        setSelectedEmployee(null);
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

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal memperbarui employee');
            }

            setEmployees((prevEmployees) =>
                prevEmployees.map((employee) =>
                    employee.id === data.employee.id
                        ? data.employee
                        : employee,
                ),
            );

            setSelectedEmployee(data.employee);
            setSuccessMessage('Employee berhasil diperbarui');
            await fetchOverview();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat memperbarui employee';

            setErrorMessage(message);
        } finally {
            setIsSavingEmployee(false);
        }
    };

    const handleRemoveEmployee = async () => {
        if (!selectedEmployee) return;

        const confirmed = window.confirm(
            `Remove ${selectedEmployee.fullname} from this clinic? Akun tidak dihapus, hanya dilepas dari klinik.`,
        );

        if (!confirmed) return;

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

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal menghapus employee');
            }

            setEmployees((prevEmployees) =>
                prevEmployees.filter(
                    (employee) => employee.id !== selectedEmployee.id,
                ),
            );

            setSelectedEmployee(null);
            setSuccessMessage('Employee berhasil dilepas dari klinik');
            await fetchOverview();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat menghapus employee';

            setErrorMessage(message);
        } finally {
            setIsSavingEmployee(false);
        }
    };

    return (
        <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#FDFEF9]">
            <div className="flex min-h-dvh w-full max-w-full overflow-x-hidden">
                <Sidebar />

                <main className="box-border flex min-w-0 flex-1 flex-col overflow-x-hidden px-4 pb-[40px] pt-[26px] sm:px-[28px]">
                    <div className="box-border w-full max-w-none min-w-0">
                        <div className="mt-[28px] box-border flex min-h-[118px] w-full max-w-full flex-col gap-[18px] rounded-[8px] bg-[#86A789] px-4 py-[24px] shadow-md sm:px-[38px] lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#FDFEF9] opacity-90">
                                    Management Setting
                                </p>

                                <h1 className="mt-[10px] truncate text-[26px] font-bold leading-none text-white">
                                    {clinic?.clinic_name || 'Clinic Management'}
                                </h1>

                                <p className="mt-[10px] text-[12px] font-medium text-white">
                                    Manage clinic information and employee
                                    access from registered accounts.
                                </p>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-[12px]">
                                <div className="rounded-[50px] bg-white px-[18px] py-[8px] text-[12px] font-bold text-[#5F785F] shadow-sm">
                                    {formatRole(currentUser?.role || '')}
                                </div>

                                <div className="rounded-[50px] bg-[#D2E3C8] px-[18px] py-[8px] text-[12px] font-bold text-[#4F6F52] shadow-sm">
                                    {stats.total_employees} Employees
                                </div>
                            </div>
                        </div>

                        {errorMessage && (
                            <div className="mt-[18px] box-border w-full rounded-[6px] border border-red-200 bg-red-50 px-[16px] py-[10px] text-[12px] text-red-700">
                                {errorMessage}
                            </div>
                        )}

                        {successMessage && (
                            <div className="mt-[18px] box-border w-full rounded-[6px] border border-green-200 bg-green-50 px-[16px] py-[10px] text-[12px] text-green-700">
                                {successMessage}
                            </div>
                        )}

                        {isLoading ? (
                            <div className="mt-[26px] w-full rounded-[8px] border border-[#D2D8CF] bg-white px-[24px] py-[28px] text-[12px] text-black">
                                Loading management setting...
                            </div>
                        ) : (
                            <>
                                <div className="mt-[26px] grid w-full min-w-0 grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-[8px] border border-[#D2D8CF] bg-white px-[22px] py-[18px] shadow-sm">
                                        <p className="text-[11px] font-semibold text-[#5F785F]">
                                            Total Employee
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
                                            Inactive
                                        </p>
                                        <h2 className="mt-[8px] text-[26px] font-bold text-black">
                                            {stats.inactive_employees}
                                        </h2>
                                    </div>

                                    <div className="rounded-[8px] border border-[#D2D8CF] bg-white px-[22px] py-[18px] shadow-sm">
                                        <p className="text-[11px] font-semibold text-[#5F785F]">
                                            Midwives
                                        </p>
                                        <h2 className="mt-[8px] text-[26px] font-bold text-black">
                                            {stats.midwives}
                                        </h2>
                                    </div>
                                </div>

                                <section className="mt-[26px] box-border w-full rounded-[8px] border border-[#D2D8CF] bg-white px-4 py-[26px] shadow-sm sm:px-[30px]">
                                    <div className="flex flex-col gap-[16px] lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <h2 className="text-[18px] font-bold leading-none text-black">
                                                Employee Management
                                            </h2>

                                            <p className="mt-[8px] text-[11px] text-black">
                                                Employees are taken from users
                                                who have registered an account.
                                                To add someone here, they must
                                                register first, then link by
                                                email.
                                            </p>
                                        </div>

                                        <form
                                            onSubmit={handleLinkEmployee}
                                            className="grid w-full min-w-0 grid-cols-1 gap-[10px] rounded-[8px] bg-[#F3F7EF] p-[14px] lg:max-w-[520px] lg:grid-cols-[1fr_150px_auto]"
                                        >
                                            <input
                                                type="email"
                                                name="email"
                                                value={linkForm.email}
                                                onChange={handleLinkFormChange}
                                                placeholder="Registered employee email"
                                                disabled={!isOwner || isLinkingEmployee}
                                                className="h-[34px] min-w-0 rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
                                            />

                                            <select
                                                name="role"
                                                value={linkForm.role}
                                                onChange={handleLinkFormChange}
                                                disabled={!isOwner || isLinkingEmployee}
                                                className="h-[34px] min-w-0 rounded-[4px] border border-[#BFC7BB] bg-white px-3 text-[12px] text-black outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
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

                                            <button
                                                type="submit"
                                                disabled={!isOwner || isLinkingEmployee}
                                                className="h-[34px] rounded-[50px] bg-[#86A789] px-[18px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
                                            >
                                                {isLinkingEmployee
                                                    ? 'Adding...'
                                                    : 'Add'}
                                            </button>
                                        </form>
                                    </div>

                                    <div className="mt-[22px] grid w-full min-w-0 grid-cols-1 gap-[12px] lg:grid-cols-[1fr_180px_180px]">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(event) =>
                                                setSearchQuery(event.target.value)
                                            }
                                            placeholder="Search employee by name, email, role, or STR..."
                                            className={inputClassName}
                                        />

                                        <select
                                            value={roleFilter}
                                            onChange={(event) =>
                                                setRoleFilter(event.target.value)
                                            }
                                            className={selectClassName}
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
                                            className={selectClassName}
                                        >
                                            <option value="all">All Status</option>
                                            <option value="active">Active</option>
                                            <option value="inactive">
                                                Inactive
                                            </option>
                                        </select>
                                    </div>

                                    <div className="mt-[20px] w-full overflow-x-auto rounded-[8px] border border-[#E4E8E1]">
                                        <table className="w-full min-w-[900px] divide-y divide-[#E4E8E1] text-[11px]">
                                            <thead className="bg-[#D2E3C8] text-[#3F3F3F]">
                                                <tr>
                                                    <th className="px-5 py-4 text-left">
                                                        Employee
                                                    </th>
                                                    <th className="px-5 py-4 text-left">
                                                        Email
                                                    </th>
                                                    <th className="px-5 py-4 text-center">
                                                        Role
                                                    </th>
                                                    <th className="px-5 py-4 text-center">
                                                        Status
                                                    </th>
                                                    <th className="px-5 py-4 text-center">
                                                        Last Login
                                                    </th>
                                                    <th className="px-5 py-4 text-center">
                                                        Action
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-[#F0F2EE] bg-white">
                                                {filteredEmployees.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-5 py-8 text-center text-gray-500"
                                                        >
                                                            No employee found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredEmployees.map(
                                                        (employee) => (
                                                            <tr
                                                                key={employee.id}
                                                                className="text-black"
                                                            >
                                                                <td className="px-5 py-4">
                                                                    <div className="flex min-w-0 items-center gap-[12px]">
                                                                        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#D2E3C8] text-[12px] font-bold text-[#4F6F52]">
                                                                            {getInitials(
                                                                                employee.fullname,
                                                                            )}
                                                                        </div>

                                                                        <div className="min-w-0">
                                                                            <p className="truncate font-bold">
                                                                                {
                                                                                    employee.fullname
                                                                                }
                                                                            </p>

                                                                            <p className="mt-[3px] truncate text-[10px] text-gray-500">
                                                                                STR:{' '}
                                                                                {employee.strnumber ||
                                                                                    '-'}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    {employee.email}
                                                                </td>

                                                                <td className="px-5 py-4 text-center">
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

                                                                <td className="px-5 py-4 text-center">
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

                                                                <td className="px-5 py-4 text-center">
                                                                    {formatDateTime(
                                                                        employee.last_login,
                                                                    )}
                                                                </td>

                                                                <td className="px-5 py-4 text-center">
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
                                </section>

                                <section className="mt-[26px] box-border w-full rounded-[8px] border border-[#D2D8CF] bg-white px-4 py-[26px] shadow-sm sm:px-[30px]">
                                    <div className="flex flex-col gap-[8px] lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <h2 className="text-[18px] font-bold leading-none text-black">
                                                Edit Clinic Information
                                            </h2>

                                            <p className="mt-[8px] text-[11px] text-black">
                                                This is global clinic data. It
                                                will be visible for all users
                                                linked to this clinic.
                                            </p>
                                        </div>

                                        {!isOwner && (
                                            <p className="rounded-[50px] bg-[#F3E8C8] px-[16px] py-[8px] text-[11px] font-bold text-[#7A5A00]">
                                                Only owner can edit clinic
                                            </p>
                                        )}
                                    </div>

                                    <form
                                        onSubmit={handleUpdateClinic}
                                        className="mt-[22px]"
                                    >
                                        <div className="grid w-full min-w-0 grid-cols-1 gap-x-[42px] gap-y-[14px] md:grid-cols-2">
                                            {clinicFields.map((field) => (
                                                <label
                                                    key={field.name}
                                                    className={`block min-w-0 ${
                                                        field.fullWidth
                                                            ? 'md:col-span-2'
                                                            : ''
                                                    }`}
                                                >
                                                    <span className="text-[11px] font-bold text-black">
                                                        {field.label}
                                                    </span>

                                                    {field.multiline ? (
                                                        <textarea
                                                            name={field.name}
                                                            value={
                                                                clinicForm[
                                                                    field.name
                                                                ]
                                                            }
                                                            onChange={
                                                                handleClinicChange
                                                            }
                                                            disabled={
                                                                !isOwner ||
                                                                isSavingClinic
                                                            }
                                                            rows={3}
                                                            className={`${inputClassName} resize-none py-2 disabled:cursor-not-allowed disabled:opacity-70`}
                                                        />
                                                    ) : (
                                                        <input
                                                            type={
                                                                field.type ||
                                                                'text'
                                                            }
                                                            name={field.name}
                                                            value={
                                                                clinicForm[
                                                                    field.name
                                                                ]
                                                            }
                                                            onChange={
                                                                handleClinicChange
                                                            }
                                                            disabled={
                                                                !isOwner ||
                                                                isSavingClinic
                                                            }
                                                            className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-70`}
                                                        />
                                                    )}
                                                </label>
                                            ))}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={!isOwner || isSavingClinic}
                                            className="mt-[24px] h-[34px] rounded-[50px] bg-[#86A789] px-[22px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            {isSavingClinic
                                                ? 'Saving...'
                                                : 'Save Clinic Changes'}
                                        </button>
                                    </form>
                                </section>
                            </>
                        )}
                    </div>
                </main>
            </div>

            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
                    <div className="relative box-border w-full max-w-[560px] overflow-hidden rounded-[16px] border border-[#D2E3C8] bg-[#FDFEF9] shadow-2xl">
                        <button
                            type="button"
                            onClick={closeEmployeeDetail}
                            disabled={isSavingEmployee}
                            className="absolute right-[18px] top-[16px] z-10 flex h-[28px] w-[28px] items-center justify-center rounded-full text-[22px] leading-none text-[#2F2F2F] transition-all hover:bg-[#EEF3EA] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Close employee detail"
                        >
                            ×
                        </button>

                        <div className="bg-white px-[26px] pb-[20px] pt-[30px] text-center">
                            <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#D2E3C8] text-[26px] font-bold text-[#4F6F52] shadow-sm">
                                {getInitials(selectedEmployee.fullname)}
                            </div>

                            <h2 className="mt-[16px] text-[24px] font-bold leading-tight text-[#0F3E8D]">
                                Employee Detail
                            </h2>

                            <p className="mt-[8px] text-[12px] text-[#444444]">
                                Review account data and update access for this
                                clinic.
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

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                            Current Status
                                        </p>
                                        <p className="mt-[5px] text-[13px] font-bold text-black">
                                            {selectedEmployee.is_active
                                                ? 'Active'
                                                : 'Inactive'}
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
                                            setSelectedRole(event.target.value)
                                        }
                                        disabled={
                                            !isOwner ||
                                            selectedEmployee.is_current_user ||
                                            isSavingEmployee
                                        }
                                        className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-70`}
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
                                        Account Status
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
                                        disabled={
                                            !isOwner ||
                                            selectedEmployee.is_current_user ||
                                            isSavingEmployee
                                        }
                                        className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-70`}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">
                                            Inactive
                                        </option>
                                    </select>
                                </label>
                            </div>

                            {selectedEmployee.is_current_user && (
                                <p className="mt-[12px] rounded-[6px] bg-[#F3E8C8] px-[12px] py-[8px] text-[11px] font-semibold text-[#7A5A00]">
                                    You cannot change your own role or deactivate
                                    yourself.
                                </p>
                            )}

                            <div className="mt-[22px] flex flex-col-reverse gap-[10px] sm:flex-row sm:items-center sm:justify-between">
                                <button
                                    type="button"
                                    onClick={handleRemoveEmployee}
                                    disabled={
                                        !isOwner ||
                                        selectedEmployee.is_current_user ||
                                        isSavingEmployee
                                    }
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
                                        disabled={
                                            !isOwner ||
                                            selectedEmployee.is_current_user ||
                                            isSavingEmployee
                                        }
                                        className="h-[36px] rounded-[50px] bg-[#0F3E8D] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#123574] disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>
    );
};

export default ManagementSetting;