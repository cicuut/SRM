'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import LoadingOverlay from '@/components/loading';
import api from '@/utils/app';
import { Search } from 'lucide-react';

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
    user_role?: Role;
    strnumber?: string | null;
    clinic_id?: string | null;
    is_active: boolean;
    profile_photo?: string | null;
    created_at?: string | null;
    last_login?: string | null;
    is_current_user?: boolean;
};

type ManagementOverviewResponse = {
    msg?: string;
    requires_clinic_setup?: boolean;
    redirect_path?: string;
    user?: Employee;
    clinic?: ClinicData | null;
    employees?: Employee[];
    roles?: Role[];
    can_create_midwife?: boolean;
    can_create_assistant?: boolean;
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

const allRoleOptions: Array<{ value: Role; label: string }> = [
    {
        value: 'admin',
        label: 'Admin',
    },
    {
        value: 'midwife',
        label: 'Bidan',
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

const normalizeRole = (value?: string | null): Role | '' => {
    const role = String(value || '').trim().toLowerCase();

    if (role === 'admin' || role === 'developer') return 'admin';

    if (role === 'midwife' || role === 'bidan' || role === 'owner') {
        return 'midwife';
    }

    if (role === 'asisten' || role === 'assistant' || role === 'staff') {
        return 'asisten';
    }

    return '';
};

const formatRole = (role: string) => {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === 'admin') return 'Admin';
    if (normalizedRole === 'midwife') return 'Bidan';
    if (normalizedRole === 'asisten') return 'Asisten';

    return '-';
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

const translateMessage = (message?: string) => {
    const rawMessage = String(message || '').trim();

    if (!rawMessage) {
        return 'Terjadi kesalahan. Silakan coba lagi.';
    }

    const normalizedMessage = rawMessage.toLowerCase();

    if (normalizedMessage.includes('failed to fetch')) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    if (normalizedMessage.includes('only admin')) {
        return 'Hanya admin yang dapat mengakses fitur ini.';
    }

    if (normalizedMessage.includes('only admin or midwife')) {
        return 'Hanya admin atau bidan yang dapat mengakses fitur ini.';
    }

    if (normalizedMessage.includes('only midwife')) {
        return 'Hanya bidan yang dapat mengakses fitur ini.';
    }

    if (normalizedMessage.includes('email is taken')) {
        return 'Email sudah digunakan.';
    }

    if (normalizedMessage.includes('str number is taken')) {
        return 'Nomor STR sudah digunakan.';
    }

    if (normalizedMessage.includes('password must be at least')) {
        return 'Password minimal 8 karakter.';
    }

    if (normalizedMessage.includes('account is inactive')) {
        return 'Akun Anda sedang tidak aktif.';
    }

    if (
        normalizedMessage.includes('deleted permanently') ||
        normalizedMessage.includes('deleted_permanently') ||
        normalizedMessage.includes('dihapus permanen')
    ) {
        return 'User berhasil dihapus permanen dari database.';
    }

    if (
        normalizedMessage.includes('dinonaktifkan') ||
        normalizedMessage.includes('deactivate') ||
        normalizedMessage.includes('deactivated')
    ) {
        return 'Status akun berhasil dinonaktifkan.';
    }

    return rawMessage;
};

const UserAvatar = ({
    name,
    photo,
    size = 'md',
}: {
    name: string;
    photo?: string | null;
    size?: 'sm' | 'md' | 'lg';
}) => {
    const sizeClassName =
        size === 'lg'
            ? 'h-[54px] w-[54px] text-[20px]'
            : size === 'sm'
              ? 'h-[36px] w-[36px] text-[12px]'
              : 'h-[38px] w-[38px] text-[12px]';

    return (
        <div
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D2E3C8] font-bold text-[#4F6F52] shadow-sm ${sizeClassName}`}
        >
            {photo ? (
                <img
                    src={photo}
                    alt={name}
                    className="h-full w-full object-cover"
                />
            ) : (
                getInitials(name)
            )}
        </div>
    );
};

const ForbiddenView = () => {
    return (
        <div className="flex min-h-[calc(100dvh-48px)] w-full items-center justify-center px-4">
            <div className="w-full max-w-[460px] rounded-[24px] border border-red-200 bg-white px-6 py-8 text-center shadow-sm">
                <div className="mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-full bg-red-50 text-[24px] font-extrabold text-red-600">
                    403
                </div>

                <h1 className="mt-5 text-[24px] font-extrabold text-[#2F3A2F]">
                    Forbidden Access
                </h1>

                <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#6B6B6B]">
                    Kamu tidak memiliki izin untuk mengakses halaman Management
                    Setting.
                </p>

                <p className="mt-2 text-[12px] font-semibold text-red-600">
                    Halaman ini hanya dapat diakses oleh admin dan bidan.
                </p>
            </div>
        </div>
    );
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
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === 'admin') {
        return 'bg-[#D2E3C8] text-[#3F5E42]';
    }

    if (normalizedRole === 'midwife') {
        return 'bg-[#E6EFD8] text-[#5F785F]';
    }

    return 'bg-[#F2F2F2] text-[#5F5F5F]';
};

const ManagementSetting = () => {
    const router = useRouter();

    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
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

    const [isForbidden, setIsForbidden] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const currentRole = normalizeRole(
        currentUser?.role || currentUser?.user_role,
    );

    const canCreateMidwife = currentRole === 'admin';
    const canCreateAssistant = currentRole === 'midwife';
    const canUpdateClinic = currentRole === 'midwife' || currentRole === 'admin';

    const showLoadingOverlay =
        isLoading || isSavingClinic || isCreatingAccount || isSavingEmployee;

    const roleFilterOptions = useMemo(() => {
        if (currentRole === 'admin') {
            return allRoleOptions.filter((role) => role.value === 'midwife');
        }

        if (currentRole === 'midwife') {
            return allRoleOptions.filter((role) =>
                ['midwife', 'asisten'].includes(role.value),
            );
        }

        return allRoleOptions;
    }, [currentRole]);

    const accountRoleOptions = useMemo(() => {
        if (currentRole === 'midwife') {
            return allRoleOptions.filter((role) => role.value === 'asisten');
        }

        if (currentRole === 'admin') {
            return allRoleOptions.filter((role) => role.value === 'midwife');
        }

        return [];
    }, [currentRole]);

    const employeeDetailRoleOptions = useMemo(() => {
        if (currentRole === 'admin') {
            return allRoleOptions.filter((role) => role.value === 'midwife');
        }

        if (currentRole === 'midwife') {
            return allRoleOptions.filter((role) => role.value === 'asisten');
        }

        return [];
    }, [currentRole]);

    const filteredEmployees = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();

        return employees.filter((employee) => {
            const employeeRole = normalizeRole(employee.role || employee.user_role);

            const matchesSearch =
                !normalizedSearch ||
                employee.fullname.toLowerCase().includes(normalizedSearch) ||
                employee.email.toLowerCase().includes(normalizedSearch) ||
                formatRole(employeeRole)
                    .toLowerCase()
                    .includes(normalizedSearch) ||
                (employee.strnumber || '')
                    .toLowerCase()
                    .includes(normalizedSearch);

            const matchesRole =
                roleFilter === 'all' || employeeRole === roleFilter;

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
        Cookies.remove('access_token', { path: '/' });

        localStorage.removeItem('user_id');
        localStorage.removeItem('temp_user_id');
        localStorage.removeItem('fullname');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('clinic_id');
        localStorage.removeItem('profile_photo');
        localStorage.removeItem('requires_clinic_setup');

        router.push('/login');
    };

    const fetchOverview = async () => {
        try {
            setIsLoading(true);
            setIsForbidden(false);
            setErrorMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.get('/auth/management/overview', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = response.data as ManagementOverviewResponse;

            const rawRole = data.user?.role || data.user?.user_role || '';
            const normalizedUserRole = normalizeRole(rawRole);

            if (
                !data.user ||
                (normalizedUserRole !== 'admin' && normalizedUserRole !== 'midwife')
            ) {
                setIsForbidden(true);
                return;
            }

            setCurrentUser(data.user);
            setEmployees(data.employees || []);
            setClinicForm(mapClinicToForm(data.clinic || null));

            localStorage.setItem('user_id', data.user.id || '');
            localStorage.setItem('temp_user_id', data.user.id || '');
            localStorage.setItem('fullname', data.user.fullname || '');
            localStorage.setItem('user_email', data.user.email || '');
            localStorage.setItem('user_role', normalizedUserRole);
            localStorage.setItem('clinic_id', data.user.clinic_id || '');
            localStorage.setItem(
                'requires_clinic_setup',
                data.requires_clinic_setup ? 'true' : 'false',
            );
        } catch (error: any) {
            if (error.response) {
                const { status, data: serverData } = error.response;

                if (status === 401 || status === 422) {
                    handleUnauthorized();
                    return;
                }

                if (status === 400 && serverData?.requires_clinic_setup) {
                    router.push(serverData.redirect_path || '/register-clinic');
                    return;
                }

                if (status === 403) {
                    setIsForbidden(true);
                    return;
                }

                setErrorMessage(
                    translateMessage(
                        serverData?.msg || 'Gagal mengambil data management.',
                    ),
                );
            } else {
                const message =
                    error instanceof Error
                        ? translateMessage(error.message)
                        : 'Terjadi kesalahan saat mengambil data management.';
                setErrorMessage(message);
            }
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
            return 'Nama klinik wajib diisi.';
        }

        if (!clinicForm.sipbNo.trim()) {
            return 'Nomor SIPB wajib diisi.';
        }

        if (!clinicForm.clinicEmail.trim()) {
            return 'Email klinik wajib diisi.';
        }

        if (!clinicForm.clinicEmail.includes('@')) {
            return 'Format email klinik tidak valid.';
        }

        if (!clinicForm.clinicPhoneNumber.trim()) {
            return 'Nomor telepon klinik wajib diisi.';
        }

        if (!clinicForm.clinicAddress.trim()) {
            return 'Alamat klinik wajib diisi.';
        }

        return '';
    };

    const validateAccountForm = (formData: AccountFormData) => {
        if (!formData.fullname.trim()) {
            return 'Nama lengkap wajib diisi.';
        }

        if (!formData.email.trim()) {
            return 'Email wajib diisi.';
        }

        if (!formData.email.includes('@')) {
            return 'Format email tidak valid.';
        }

        if (formData.role === 'midwife' && !formData.strnumber.trim()) {
            return 'Nomor STR wajib diisi untuk akun bidan.';
        }

        if (!formData.password || formData.password.length < 8) {
            return 'Password minimal 8 karakter.';
        }

        if (!formData.confirmPassword) {
            return 'Konfirmasi password wajib diisi.';
        }

        if (formData.password !== formData.confirmPassword) {
            return 'Konfirmasi password tidak sama.';
        }

        if (currentRole === 'midwife' && formData.role !== 'asisten') {
            return 'Bidan hanya dapat membuat akun asisten.';
        }

        if (currentRole === 'admin' && formData.role !== 'midwife') {
            return 'Admin hanya dapat membuat akun bidan melalui halaman Add Midwife.';
        }

        return '';
    };

    const openAccountModal = () => {
        if (!canCreateAssistant) return;

        setAccountForm({
            ...emptyAccountForm,
            role: 'asisten',
        });
        setErrorMessage('');
        setSuccessMessage('');
        setIsAccountModalOpen(true);
    };

    const closeAccountModal = () => {
        if (isCreatingAccount) return;

        setIsAccountModalOpen(false);
        setAccountForm(emptyAccountForm);
    };

    const handleGoToAddMidwife = () => {
        router.push('/regist');
    };

    const handleUpdateClinic = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canUpdateClinic) {
            setErrorMessage(
                'Hanya bidan atau admin yang dapat memperbarui data klinik.',
            );
            return;
        }

        try {
            setIsSavingClinic(true);
            setErrorMessage('');
            setSuccessMessage('');

            const validationMessage = validateClinicForm();

            if (validationMessage) {
                setErrorMessage(validationMessage);
                setIsSavingClinic(false);
                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.patch(
                '/auth/management/clinic',
                {
                    clinic_name: clinicForm.clinicName.trim(),
                    license_number: clinicForm.sipbNo.trim(),
                    clinic_email: clinicForm.clinicEmail.trim(),
                    clinic_phone: clinicForm.clinicPhoneNumber.trim(),
                    clinic_address: clinicForm.clinicAddress.trim(),
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            const data = response.data;

            setClinicForm(mapClinicToForm(data.clinic));
            setSuccessMessage('Informasi klinik berhasil diperbarui.');
            await fetchOverview();
        } catch (error: any) {
            if (error.response) {
                const status = error.response.status;
                const serverData = error.response.data;

                if (status === 401 || status === 422) {
                    handleUnauthorized();
                    return;
                }

                if (status === 403) {
                    setErrorMessage(
                        translateMessage(
                            serverData?.msg ||
                                'Anda tidak memiliki izin memperbarui klinik.',
                        ),
                    );
                    return;
                }

                setErrorMessage(
                    translateMessage(
                        serverData?.msg || 'Gagal memperbarui data klinik.',
                    ),
                );
            } else {
                const message =
                    error instanceof Error
                        ? translateMessage(error.message)
                        : 'Terjadi kesalahan saat memperbarui data klinik.';
                setErrorMessage(message);
            }
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

            const nextAccountForm = {
                ...accountForm,
                role: currentRole === 'midwife' ? 'asisten' : accountForm.role,
            };

            const validationMessage = validateAccountForm(nextAccountForm);

            if (validationMessage) {
                setErrorMessage(validationMessage);
                setIsCreatingAccount(false);
                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            await api.post(
                '/auth/management/users',
                {
                    fullname: nextAccountForm.fullname.trim(),
                    email: nextAccountForm.email.trim(),
                    password: nextAccountForm.password,
                    strnumber: nextAccountForm.strnumber.trim() || null,
                    role: nextAccountForm.role,
                    is_active: nextAccountForm.isActive,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            setAccountForm(emptyAccountForm);
            setIsAccountModalOpen(false);
            setSuccessMessage('Akun user berhasil dibuat.');
            await fetchOverview();
        } catch (error: any) {
            if (error.response) {
                const { status, data: serverData } = error.response;

                if (status === 401 || status === 422) {
                    handleUnauthorized();
                    return;
                }

                if (status === 400 && serverData?.requires_clinic_setup) {
                    router.push(serverData.redirect_path || '/register-clinic');
                    return;
                }

                if (status === 403) {
                    setErrorMessage(
                        translateMessage(serverData?.msg || 'Anda tidak memiliki izin.'),
                    );
                    return;
                }

                setErrorMessage(
                    translateMessage(serverData?.msg || 'Gagal membuat akun user.'),
                );
            } else {
                setErrorMessage(
                    error instanceof Error
                        ? translateMessage(error.message)
                        : 'Terjadi kesalahan saat membuat akun user.',
                );
            }
        } finally {
            setIsCreatingAccount(false);
        }
    };

    const openEmployeeDetail = (employee: Employee) => {
        const employeeRole = normalizeRole(employee.role || employee.user_role);

        setSelectedEmployee(employee);
        setSelectedRole((employeeRole || 'asisten') as Role);
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

            const previousRole = normalizeRole(
                selectedEmployee.role || selectedEmployee.user_role,
            );
            const previousIsActive = Boolean(selectedEmployee.is_active);

            const roleChanged = selectedRole !== previousRole;
            const statusChanged = selectedIsActive !== previousIsActive;

            if (!roleChanged && !statusChanged) {
                setSuccessMessage('Tidak ada perubahan data user.');
                return;
            }

            let latestEmployee = selectedEmployee;

            if (roleChanged) {
                const roleResponse = await api.patch(
                    `/auth/management/employees/${selectedEmployee.id}`,
                    {
                        role: selectedRole,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    },
                );

                latestEmployee = roleResponse.data.employee;
            }

            if (statusChanged) {
                const statusResponse = await api.patch(
                    `/auth/management/employees/${selectedEmployee.id}/status`,
                    {
                        is_active: selectedIsActive,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    },
                );

                latestEmployee = statusResponse.data.employee;
            }

            setSelectedEmployee(latestEmployee);
            setSelectedIsActive(Boolean(latestEmployee.is_active));
            setSelectedRole(
                (normalizeRole(latestEmployee.role || latestEmployee.user_role) ||
                    'asisten') as Role,
            );

            if (roleChanged && statusChanged) {
                setSuccessMessage('Role dan status akun berhasil diperbarui.');
            } else if (roleChanged) {
                setSuccessMessage('Role akun berhasil diperbarui.');
            } else {
                setSuccessMessage(
                    selectedIsActive
                        ? 'Akun berhasil diaktifkan.'
                        : 'Akun berhasil dinonaktifkan.',
                );
            }

            await fetchOverview();
        } catch (error: any) {
            if (error.response) {
                const { status, data: serverData } = error.response;

                if (status === 401 || status === 422) {
                    handleUnauthorized();
                    return;
                }

                if (status === 400 && serverData?.requires_clinic_setup) {
                    router.push(serverData.redirect_path || '/register-clinic');
                    return;
                }

                if (status === 403) {
                    setErrorMessage(
                        translateMessage(serverData?.msg || 'Anda tidak memiliki izin.'),
                    );
                    return;
                }

                setErrorMessage(
                    translateMessage(serverData?.msg || 'Gagal memperbarui user.'),
                );
            } else {
                setErrorMessage(
                    error instanceof Error
                        ? translateMessage(error.message)
                        : 'Terjadi kesalahan saat memperbarui user.',
                );
            }
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

            await api.delete(`/auth/management/employees/${selectedEmployee.id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            setIsDeleteModalOpen(false);
            setSelectedEmployee(null);
            setSuccessMessage('User berhasil dihapus permanen dari database.');
            await fetchOverview();
        } catch (error: any) {
            if (error.response) {
                const { status, data: serverData } = error.response;

                if (status === 401 || status === 422) {
                    handleUnauthorized();
                    return;
                }

                if (status === 400 && serverData?.requires_clinic_setup) {
                    router.push(serverData.redirect_path || '/register-clinic');
                    return;
                }

                if (status === 400 || status === 403) {
                    setErrorMessage(
                        translateMessage(serverData?.msg || 'User ini tidak bisa dihapus.'),
                    );
                    return;
                }

                setErrorMessage(
                    translateMessage(serverData?.msg || 'Gagal menghapus user.'),
                );
            } else {
                setErrorMessage(
                    error instanceof Error
                        ? translateMessage(error.message)
                        : 'Terjadi kesalahan saat menghapus user.',
                );
            }
        } finally {
            setIsSavingEmployee(false);
        }
    };

    if (isForbidden) {
        return <ForbiddenView />;
    }

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
                        Memuat data management...
                    </div>
                ) : (
                    <>
                        <section className="overflow-hidden rounded-[22px] border border-[#D2D8CF] bg-white shadow-sm">
                            <div className="flex flex-col gap-4 border-b border-[#E4E8E1] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                                        Akses User
                                    </h2>

                                    <p className="mt-2 text-[12px] font-medium text-[#6B6B6B]">
                                        {currentRole === 'admin'
                                            ? 'Admin dapat membuat dan mengelola akun bidan.'
                                            : 'Bidan dapat membuat dan mengelola akun asisten di kliniknya.'}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    {canCreateMidwife && (
                                        <button
                                            type="button"
                                            onClick={handleGoToAddMidwife}
                                            className="flex min-h-[38px] items-center justify-center rounded-[50px] bg-[#4F6F52] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#3F5E42]"
                                        >
                                            Add Midwife
                                        </button>
                                    )}

                                    {canCreateAssistant && (
                                        <button
                                            type="button"
                                            onClick={openAccountModal}
                                            className="flex min-h-[38px] items-center justify-center rounded-[50px] bg-[#86A789] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            Add Account
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="px-5 py-5 sm:px-6">
                                <div className="grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_380px]">
                                    <div className="relative min-w-0 rounded-[50px] border border-[#D2D8CF] bg-[#FDFEF9] px-5 py-[11px] shadow-sm transition-all focus-within:border-[#739072]">
                                        <Search className="absolute left-5 top-1/2 w-3.5 -translate-y-1/2 text-gray-400 md:w-4" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(event) =>
                                                setSearchQuery(event.target.value)
                                            }
                                            placeholder="Cari user berdasarkan nama, email, role, atau STR..."
                                            className="w-full bg-transparent pl-8 text-[13px] text-gray-700 outline-none placeholder-gray-400"
                                        />
                                    </div>

                                    <div className="flex h-[40px] items-center justify-center whitespace-nowrap rounded-[50px] bg-[#D2E3C8] px-5 text-[12px] font-bold text-[#4F6F52] shadow-sm">
                                        {employees.length} User
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <select
                                            value={roleFilter}
                                            onChange={(event) =>
                                                setRoleFilter(event.target.value)
                                            }
                                            className="h-8 rounded-[50px] border border-[#D2D8CF] bg-white text-center text-[9px] font-bold text-[#4B4B4B] shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072] md:h-[40px] md:text-[12px]"
                                        >
                                            <option value="all">Semua Role</option>
                                            {roleFilterOptions.map((role) => (
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
                                            className="h-8 rounded-[50px] border border-[#D2D8CF] bg-white text-center text-[9px] font-bold text-[#4B4B4B] shadow-sm outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072] md:h-[40px] md:text-[12px]"
                                        >
                                            <option value="all">Semua Status</option>
                                            <option value="active">Aktif</option>
                                            <option value="inactive">Tidak Aktif</option>
                                        </select>
                                    </div>
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
                                                    Login Terakhir
                                                </th>
                                                <th className="px-5 py-4">
                                                    Aksi
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
                                                        Tidak ada user ditemukan
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
                                                                    <UserAvatar
                                                                        name={
                                                                            employee.fullname
                                                                        }
                                                                        photo={
                                                                            employee.profile_photo
                                                                        }
                                                                        size="sm"
                                                                    />

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
                                                                        ? 'Aktif'
                                                                        : 'Tidak Aktif'}
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
                                            Tidak ada user ditemukan
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
                                                    <UserAvatar
                                                        name={
                                                            employee.fullname
                                                        }
                                                        photo={
                                                            employee.profile_photo
                                                        }
                                                        size="md"
                                                    />

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
                                                                    ? 'Aktif'
                                                                    : 'Tidak Aktif'}
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

                        {canUpdateClinic && (
                            <section className="rounded-[22px] border border-[#D2D8CF] bg-white px-5 py-5 shadow-sm sm:px-6">
                                <div className="border-b border-[#E4E8E1] pb-4">
                                    <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                                        Informasi Klinik
                                    </h2>
                                </div>

                                <form
                                    onSubmit={handleUpdateClinic}
                                    className="mt-5 grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2"
                                >
                                    <label className="block min-w-0">
                                        <span className="text-[11px] font-bold text-black">
                                            Nama Klinik
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
                                            Nomor SIPB
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
                                            Email Klinik
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
                                            Nomor Telepon Klinik
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
                                            Alamat Klinik
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
                                                ? 'Menyimpan...'
                                                : 'Update Klinik'}
                                        </button>
                                    </div>
                                </form>
                            </section>
                        )}
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
                            aria-label="Tutup modal tambah akun"
                        >
                            ×
                        </button>

                        <div className="border-b border-[#E4E8E1] px-[26px] py-[22px]">
                            <h2 className="text-[22px] font-bold leading-tight text-[#4F6F52]">
                                Tambah Akun
                            </h2>
                            <p className="mt-1 text-[12px] text-[#6B6B6B]">
                                Buat akun asisten untuk akses user klinik.
                            </p>
                        </div>

                        <form
                            onSubmit={handleCreateAccount}
                            className="px-[26px] py-[24px]"
                        >
                            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                                <label className="block min-w-0">
                                    <span className="text-[11px] font-bold text-black">
                                        Nama Lengkap
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
                                        Nomor STR
                                        <span className="ml-1 font-medium text-gray-500">
                                            (opsional untuk asisten)
                                        </span>
                                    </span>
                                    <input
                                        type="text"
                                        name="strnumber"
                                        value={accountForm.strnumber}
                                        onChange={handleAccountChange}
                                        placeholder="Boleh dikosongkan untuk akun asisten"
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
                                        {accountRoleOptions.map((role) => (
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
                                        Konfirmasi Password
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
                                        <option value="active">Aktif</option>
                                        <option value="inactive">Tidak Aktif</option>
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
                                    Batal
                                </button>

                                <button
                                    type="submit"
                                    disabled={isCreatingAccount}
                                    className="h-[36px] rounded-[50px] bg-[#86A789] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isCreatingAccount
                                        ? 'Membuat...'
                                        : 'Buat Akun'}
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
                            aria-label="Tutup detail user"
                        >
                            ×
                        </button>

                        <div className="border-b border-[#E4E8E1] px-[26px] py-[22px]">
                            <div className="flex items-start gap-4">
                                <UserAvatar
                                    name={selectedEmployee.fullname}
                                    photo={selectedEmployee.profile_photo}
                                    size="lg"
                                />

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
                                        Nomor STR
                                    </p>
                                    <p className="mt-[5px] text-[13px] font-bold text-black">
                                        {selectedEmployee.strnumber || '-'}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                        Bergabung
                                    </p>
                                    <p className="mt-[5px] text-[13px] font-bold text-black">
                                        {formatDateTime(
                                            selectedEmployee.created_at,
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5F785F]">
                                        Login Terakhir
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
                                        {employeeDetailRoleOptions.map((role) => (
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
                                        Status Akun
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
                                        <option value="active">Aktif</option>
                                        <option value="inactive">Tidak Aktif</option>
                                    </select>
                                    <p className="mt-2 text-[10px] font-medium text-[#6B6B6B]">
                                        Status tidak aktif hanya menonaktifkan
                                        login akun. Data user tetap tersimpan.
                                    </p>
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
                                    Hapus Permanen
                                </button>

                                <div className="flex flex-col-reverse gap-[10px] sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={closeEmployeeDetail}
                                        disabled={isSavingEmployee}
                                        className="h-[36px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-black transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Batal
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSaveEmployee}
                                        disabled={isSavingEmployee}
                                        className="h-[36px] rounded-[50px] bg-[#86A789] px-[20px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSavingEmployee
                                            ? 'Menyimpan...'
                                            : 'Simpan Perubahan'}
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
                            Hapus User?
                        </h2>

                        <p className="mt-3 text-[13px] leading-relaxed text-[#4B4B4B]">
                            User{' '}
                            <span className="font-bold">
                                {selectedEmployee.fullname}
                            </span>{' '}
                            akan dihapus dari sistem dan tidak dapat digunakan lagi untuk login.
                        </p>

                        <div className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-relaxed text-red-700">
                            Tindakan ini bersifat permanen. Jika hanya ingin menghentikan
                            akses sementara, ubah status akun menjadi Tidak Aktif.
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={isSavingEmployee}
                                className="h-[36px] rounded-[50px] border border-[#BFC7BB] bg-white px-[18px] text-[12px] font-bold text-black transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Batal
                            </button>

                            <button
                                type="button"
                                onClick={handleRemoveEmployee}
                                disabled={isSavingEmployee}
                                className="h-[36px] rounded-[50px] bg-red-600 px-[18px] text-[12px] font-bold text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSavingEmployee
                                    ? 'Menghapus...'
                                    : 'Hapus Permanen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ManagementSetting;