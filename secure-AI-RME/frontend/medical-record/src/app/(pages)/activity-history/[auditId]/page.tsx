'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import LoadingOverlay from '@/components/loading';
import api from '@/utils/app';

type Role = 'admin' | 'midwife' | 'asisten' | '';

type DetailItem = {
    key: string;
    label: string;
    value: string;
};

type ChangedField = {
    key: string;
    label: string;
    old_value: string;
    new_value: string;
};

type BillingItem = {
    item_id?: string;
    item_name?: string;
    quantity?: number | string;
    unit_cost?: number | string;
    subtotal?: number | string;
};

type ActivityDetail = {
    audit_id: string;
    audit_number: string;
    date_time: string;
    user: string;
    user_email: string;
    user_role: string;
    action: string;
    module: string;
    record_id: string;
    raw_record_id: string;
    old_value: string;
    new_value: string;
    old_items: DetailItem[];
    new_items: DetailItem[];
    changed_fields: ChangedField[];
};

type DetailResponse = {
    msg?: string;
    data?: ActivityDetail;
};

type MeResponse = {
    msg?: string;
    requires_clinic_setup?: boolean;
    redirect_path?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role?: string;
        user_role?: string;
        clinic_id?: string | null;
        is_active?: boolean;
    };
    clinic?: {
        id: string;
        clinic_name: string;
    } | null;
};

const ACTIVITY_ALLOWED_ROLES: Role[] = ['midwife'];

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const normalizeRole = (value?: string | null): Role => {
    const role = String(value || '').trim().toLowerCase();

    if (role === 'admin') return 'admin';
    if (role === 'developer') return 'admin';

    if (role === 'midwife') return 'midwife';
    if (role === 'bidan') return 'midwife';
    if (role === 'owner') return 'midwife';

    if (role === 'asisten') return 'asisten';
    if (role === 'assistant') return 'asisten';
    if (role === 'staff') return 'asisten';

    return '';
};

const translateMessage = (message?: string) => {
    const rawMessage = String(message || '').trim();

    if (!rawMessage) {
        return 'Terjadi kesalahan. Silakan coba lagi.';
    }

    const normalized = rawMessage.toLowerCase();

    if (normalized.includes('failed to fetch')) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    if (normalized.includes('network error')) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    if (normalized.includes('user not found')) {
        return 'User tidak ditemukan.';
    }

    if (normalized.includes('inactive')) {
        return 'Akun Anda sedang tidak aktif.';
    }

    if (normalized.includes('forbidden') || normalized.includes('access denied')) {
        return 'Kamu tidak memiliki izin untuk mengakses detail riwayat aktivitas.';
    }

    if (normalized.includes('not found')) {
        return 'Detail riwayat aktivitas tidak ditemukan.';
    }

    if (normalized.includes('failed to get')) {
        return 'Gagal mengambil detail riwayat aktivitas.';
    }

    return rawMessage;
};

const formatActionLabel = (value: string) => {
    if (!value) return '-';

    return value
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(' ');
};

const formatRole = (value: string) => {
    const role = normalizeRole(value);

    if (role === 'admin') return 'Admin';
    if (role === 'midwife') return 'Bidan';
    if (role === 'asisten') return 'Asisten';

    if (!value) return '-';

    return value
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(' ');
};

const formatDateTime = (value: string) => {
    if (!value) return '-';

    const date = new Date(value.replace(' ', 'T'));

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getActionBadgeClassName = (action: string) => {
    const normalizedAction = action.toLowerCase();

    if (
        normalizedAction.includes('delete') ||
        normalizedAction.includes('remove')
    ) {
        return 'bg-red-50 text-red-600';
    }

    if (
        normalizedAction.includes('add') ||
        normalizedAction.includes('create') ||
        normalizedAction.includes('register')
    ) {
        return 'bg-[#D2E3C8] text-[#4F6F52]';
    }

    if (
        normalizedAction.includes('update') ||
        normalizedAction.includes('change') ||
        normalizedAction.includes('edit')
    ) {
        return 'bg-[#EAF1E4] text-[#5F785F]';
    }

    if (normalizedAction.includes('login')) {
        return 'bg-[#F3E8C8] text-[#7A5A00]';
    }

    return 'bg-[#F2F2F2] text-[#5F5F5F]';
};

const getActivityMode = (action: string) => {
    const normalizedAction = action.toLowerCase();

    if (
        normalizedAction.includes('delete') ||
        normalizedAction.includes('remove')
    ) {
        return 'delete';
    }

    if (
        normalizedAction.includes('create') ||
        normalizedAction.includes('add') ||
        normalizedAction.includes('register')
    ) {
        return 'create';
    }

    return 'update';
};

const isBillingItemsField = (key: string, label: string) => {
    const normalizedKey = String(key || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, '');
    const normalizedLabel = String(label || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, '');

    return (
        normalizedKey === 'billingitems' ||
        normalizedLabel === 'billingitems' ||
        normalizedLabel === 'rincianbiaya'
    );
};

const getReadableFieldLabel = (key: string, label: string) => {
    if (isBillingItemsField(key, label)) {
        return 'Rincian Biaya';
    }

    return label;
};

const parseBillingItems = (value?: string | null): BillingItem[] | null => {
    if (!value || value === '-') {
        return [];
    }

    let parsedValue: unknown = value;

    try {
        parsedValue = JSON.parse(value);

        if (typeof parsedValue === 'string') {
            parsedValue = JSON.parse(parsedValue);
        }
    } catch {
        return null;
    }

    if (!Array.isArray(parsedValue)) {
        return null;
    }

    const items = parsedValue.filter(
        (item): item is BillingItem =>
            typeof item === 'object' && item !== null,
    );

    return items;
};

const toNumber = (value?: number | string) => {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const formatRupiah = (value?: number | string) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(toNumber(value));
};

const formatQuantity = (value?: number | string) => {
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(toNumber(value));
};

const getBillingItemSubtotal = (item: BillingItem) => {
    const subtotal = toNumber(item.subtotal);

    if (subtotal > 0 || toNumber(item.quantity) === 0) {
        return subtotal;
    }

    return toNumber(item.quantity) * toNumber(item.unit_cost);
};

const BillingItemsValue = ({
    items,
    compact = false,
}: {
    items: BillingItem[];
    compact?: boolean;
}) => {
    const total = items.reduce(
        (currentTotal, item) =>
            currentTotal + getBillingItemSubtotal(item),
        0,
    );

    if (items.length === 0) {
        return (
            <div className="rounded-[10px] border border-dashed border-[#D2D8CF] bg-white px-3 py-3 text-center text-[11px] text-gray-500">
                Tidak ada rincian biaya.
            </div>
        );
    }

    if (compact) {
        return (
            <div className="space-y-2 text-left">
                {items.map((item, index) => {
                    const quantity = toNumber(item.quantity);
                    const unitCost = toNumber(item.unit_cost);
                    const subtotal = getBillingItemSubtotal(item);

                    return (
                        <div
                            key={item.item_id || `${item.item_name}-${index}`}
                            className="rounded-[10px] border border-[#E1E7DD] bg-[#F8FAF6] px-3 py-2.5"
                        >
                            <p className="break-words text-[11px] font-bold text-[#2F3A2F]">
                                {item.item_name || `Item ${index + 1}`}
                            </p>

                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-[#5F5F5F]">
                                <span>
                                    {formatQuantity(quantity)} ×{' '}
                                    {formatRupiah(unitCost)}
                                </span>
                                <span className="font-bold text-[#4F6F52]">
                                    {formatRupiah(subtotal)}
                                </span>
                            </div>
                        </div>
                    );
                })}

                <div className="flex items-center justify-between border-t border-[#D2D8CF] px-1 pt-2 text-[11px]">
                    <span className="font-semibold text-[#5F5F5F]">Total</span>
                    <span className="font-extrabold text-[#4F6F52]">
                        {formatRupiah(total)}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-[12px] border border-[#D2D8CF] bg-white">
            <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
                    <thead>
                        <tr className="bg-[#EAF1E4] text-[10px] font-bold uppercase text-[#4F6F52]">
                            <th className="px-4 py-3">Nama Layanan</th>
                            <th className="px-4 py-3 text-center">Jumlah</th>
                            <th className="px-4 py-3 text-right">
                                Harga Satuan
                            </th>
                            <th className="px-4 py-3 text-right">Subtotal</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-[#EDF0EA]">
                        {items.map((item, index) => (
                            <tr
                                key={
                                    item.item_id ||
                                    `${item.item_name}-${index}`
                                }
                                className="text-[12px] text-[#4B4B4B]"
                            >
                                <td className="break-words px-4 py-3 font-semibold text-[#2F3A2F]">
                                    {item.item_name || `Item ${index + 1}`}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {formatQuantity(item.quantity)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                    {formatRupiah(item.unit_cost)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-[#4F6F52]">
                                    {formatRupiah(
                                        getBillingItemSubtotal(item),
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>

                    <tfoot>
                        <tr className="border-t border-[#D2D8CF] bg-[#F8FAF6]">
                            <td
                                colSpan={3}
                                className="px-4 py-3 text-right text-[11px] font-bold text-[#5F5F5F]"
                            >
                                Total
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] font-extrabold text-[#4F6F52]">
                                {formatRupiah(total)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="space-y-3 p-3 sm:hidden">
                {items.map((item, index) => (
                    <div
                        key={item.item_id || `${item.item_name}-${index}`}
                        className="rounded-[10px] border border-[#E4E8E1] bg-[#F8FAF6] px-3 py-3"
                    >
                        <p className="break-words text-[12px] font-bold text-[#2F3A2F]">
                            {item.item_name || `Item ${index + 1}`}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[#5F5F5F]">
                            <span>
                                {formatQuantity(item.quantity)} ×{' '}
                                {formatRupiah(item.unit_cost)}
                            </span>
                            <span className="font-bold text-[#4F6F52]">
                                {formatRupiah(getBillingItemSubtotal(item))}
                            </span>
                        </div>
                    </div>
                ))}

                <div className="flex items-center justify-between border-t border-[#D2D8CF] px-1 pt-3 text-[12px]">
                    <span className="font-bold text-[#5F5F5F]">Total</span>
                    <span className="font-extrabold text-[#4F6F52]">
                        {formatRupiah(total)}
                    </span>
                </div>
            </div>
        </div>
    );
};

const AuditValue = ({
    fieldKey,
    label,
    value,
    compact = false,
}: {
    fieldKey: string;
    label: string;
    value?: string | null;
    compact?: boolean;
}) => {
    if (isBillingItemsField(fieldKey, label)) {
        const billingItems = parseBillingItems(value);

        if (billingItems !== null) {
            return (
                <BillingItemsValue items={billingItems} compact={compact} />
            );
        }
    }

    return (
        <p className="whitespace-pre-wrap break-words">{value || '-'}</p>
    );
};

const DetailField = ({
    fieldKey,
    label,
    value,
}: {
    fieldKey?: string;
    label: string;
    value?: string | null;
}) => {
    const readableLabel = getReadableFieldLabel(fieldKey || label, label);

    return (
        <div className="min-w-0">
            <p className="text-[11px] font-bold text-black">
                {readableLabel}
            </p>

            <div className="mt-[8px] min-h-[42px] rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-4 py-3 text-[13px] font-medium text-[#4B4B4B]">
                <AuditValue
                    fieldKey={fieldKey || label}
                    label={label}
                    value={value}
                />
            </div>
        </div>
    );
};

const ValueList = ({
    title,
    items,
    emptyText,
}: {
    title: string;
    items: DetailItem[];
    emptyText: string;
}) => {
    return (
        <section className="rounded-[22px] border border-[#D2D8CF] bg-white shadow-sm">
            <div className="border-b border-[#E4E8E1] px-5 py-5 sm:px-6">
                <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                    {title}
                </h2>
            </div>

            <div className="px-5 py-5 sm:px-6">
                {items.length === 0 ? (
                    <div className="rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[12px] text-gray-500">
                        {emptyText}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {items.map((item) => {
                            const isBillingItems = isBillingItemsField(
                                item.key,
                                item.label,
                            );

                            return (
                                <div
                                    key={`${item.key}-${item.label}`}
                                    className={
                                        isBillingItems
                                            ? 'md:col-span-2'
                                            : undefined
                                    }
                                >
                                    <DetailField
                                        fieldKey={item.key}
                                        label={item.label}
                                        value={item.value}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
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
                    Kamu tidak memiliki izin untuk mengakses detail riwayat
                    aktivitas.
                </p>

                <p className="mt-2 text-[12px] font-semibold text-red-600">
                    Halaman ini hanya dapat diakses oleh admin dan bidan.
                </p>
            </div>
        </div>
    );
};

const ActivityHistoryDetail = () => {
    const router = useRouter();
    const params = useParams();

    const auditId = useMemo(() => {
        const value = params?.auditId || params?.id;

        if (Array.isArray(value)) {
            return value[0] || '';
        }

        return value || '';
    }, [params]);

    const [detail, setDetail] = useState<ActivityDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isForbidden, setIsForbidden] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const clearSession = () => {
        Cookies.remove('access_token', { path: '/' });

        localStorage.removeItem('user_id');
        localStorage.removeItem('temp_user_id');
        localStorage.removeItem('fullname');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('clinic_id');
        localStorage.removeItem('profile_photo');
        localStorage.removeItem('requires_clinic_setup');
    };

    const handleUnauthorized = () => {
        clearSession();
        router.push('/login');
    };

    const saveUserSession = (data: MeResponse, role: Role) => {
        if (!data.user) return;

        localStorage.setItem('user_id', data.user.id || '');
        localStorage.setItem('temp_user_id', data.user.id || '');
        localStorage.setItem('fullname', data.user.fullname || '');
        localStorage.setItem('user_email', data.user.email || '');
        localStorage.setItem('user_role', role || '');
        localStorage.setItem('clinic_id', data.user.clinic_id || '');
        localStorage.setItem(
            'requires_clinic_setup',
            data.requires_clinic_setup ? 'true' : 'false',
        );
    };

    const checkAccess = async () => {
        const token = Cookies.get('access_token');

        if (!token) {
            handleUnauthorized();
            return null;
        }

        const response = await api.get('/auth/me', {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = response.data as MeResponse;

        if (response.status === 401 || response.status === 422) {
            handleUnauthorized();
            return null;
        }

        if (response.status === 403) {
            setIsForbidden(true);
            return null;
        }

        if (response.status !== 200 || !data.user) {
            throw new Error(data?.msg || 'Gagal memeriksa akses user.');
        }

        const role = normalizeRole(data.user.role || data.user.user_role);

        saveUserSession(data, role);

        if (role === 'midwife' && data.requires_clinic_setup) {
            router.push(data.redirect_path || '/register-clinic');
            return null;
        }

        if (!ACTIVITY_ALLOWED_ROLES.includes(role)) {
            setIsForbidden(true);
            return null;
        }

        return token;
    };

    const fetchDetail = async () => {
        try {
            setIsLoading(true);
            setIsForbidden(false);
            setErrorMessage('');

            const token = await checkAccess();

            if (!token) {
                return;
            }

            const response = await api.get(`/activity-history/detail/${auditId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            const data = response.data ;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                setIsForbidden(true);
                return;
            }

            if (response.status !== 200 || !data.data) {
                throw new Error(
                    data?.msg || 'Gagal mengambil detail riwayat aktivitas.',
                );
            }

            setDetail(data.data);
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Terjadi kesalahan saat mengambil detail riwayat aktivitas.';

            setErrorMessage(message);
            setDetail(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!auditId) return;

        fetchDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auditId]);

    if (isLoading) {
        return (
            <div className="relative flex min-h-[calc(100dvh-48px)] w-full items-center justify-center">
                <LoadingOverlay />
            </div>
        );
    }

    if (isForbidden) {
        return <ForbiddenView />;
    }

    const activityMode = detail ? getActivityMode(detail.action) : 'update';

    return (
        <div className="relative flex w-full min-w-0 flex-col gap-5">
            {errorMessage && (
                <div className="w-full rounded-[10px] border border-red-200 bg-red-50 px-[16px] py-[12px] text-[12px] font-medium text-red-700">
                    {errorMessage}
                </div>
            )}

            {!detail ? (
                <section className="rounded-[22px] border border-[#D2D8CF] bg-white px-5 py-8 text-center text-[13px] text-gray-500 shadow-sm">
                    Detail riwayat aktivitas tidak ditemukan.
                </section>
            ) : (
                <>
                    <section className="rounded-[22px] border border-[#D2D8CF] bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-[#E4E8E1] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                            <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                                Informasi Log
                            </h2>

                            <span
                                className={`inline-flex w-fit justify-center rounded-full px-4 py-2 text-[11px] font-bold ${getActionBadgeClassName(
                                    detail.action,
                                )}`}
                            >
                                {formatActionLabel(detail.action)}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
                            <DetailField
                                label="Nomor Audit"
                                value={detail.audit_number}
                            />

                            <DetailField
                                label="Tanggal"
                                value={formatDateTime(detail.date_time)}
                            />

                            <DetailField
                                label="Modul"
                                value={detail.module}
                            />

                            <DetailField
                                label="ID Record"
                                value={detail.record_id}
                            />

                            <DetailField
                                label="User"
                                value={detail.user}
                            />

                            <DetailField
                                label="Email User"
                                value={detail.user_email}
                            />

                            <DetailField
                                label="Role User"
                                value={formatRole(detail.user_role)}
                            />

                            <DetailField
                                label="Aksi"
                                value={formatActionLabel(detail.action)}
                            />
                        </div>
                    </section>

                    {activityMode === 'update' && (
                        <section className="rounded-[22px] border border-[#D2D8CF] bg-white shadow-sm">
                            <div className="border-b border-[#E4E8E1] px-5 py-5 sm:px-6">
                                <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                                    Perubahan Data
                                </h2>
                            </div>

                            {detail.changed_fields.length === 0 ? (
                                <div className="px-5 py-5 sm:px-6">
                                    <div className="rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[12px] text-gray-500">
                                        Tidak ada perubahan field yang tercatat.
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="hidden w-full overflow-x-auto lg:block">
                                        <table className="w-full border-separate border-spacing-0 text-[12px]">
                                            <thead>
                                                <tr className="bg-[#D2E3C8] text-center text-[10px] font-bold uppercase text-gray-700">
                                                    <th className="px-6 py-4">
                                                        Field
                                                    </th>
                                                    <th className="px-6 py-4">
                                                        Sebelum
                                                    </th>
                                                    <th className="px-6 py-4">
                                                        Sesudah
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-gray-100">
                                                {detail.changed_fields.map(
                                                    (item) => (
                                                        <tr
                                                            key={item.key}
                                                            className="text-center text-black transition-all hover:bg-[#EEF3E9]"
                                                        >
                                                            <td className="px-4 py-4 font-bold text-[#4F6F52]">
                                                                {getReadableFieldLabel(
                                                                    item.key,
                                                                    item.label,
                                                                )}
                                                            </td>

                                                            <td className="px-4 py-4">
                                                                <div className="mx-auto max-w-[420px] text-left">
                                                                    <AuditValue
                                                                        fieldKey={
                                                                            item.key
                                                                        }
                                                                        label={
                                                                            item.label
                                                                        }
                                                                        value={
                                                                            item.old_value
                                                                        }
                                                                        compact
                                                                    />
                                                                </div>
                                                            </td>

                                                            <td className="px-4 py-4">
                                                                <div className="mx-auto max-w-[420px] text-left">
                                                                    <AuditValue
                                                                        fieldKey={
                                                                            item.key
                                                                        }
                                                                        label={
                                                                            item.label
                                                                        }
                                                                        value={
                                                                            item.new_value
                                                                        }
                                                                        compact
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 px-4 py-4 lg:hidden">
                                        {detail.changed_fields.map((item) => (
                                            <div
                                                key={item.key}
                                                className="rounded-[16px] border border-[#E4E8E1] bg-white px-4 py-4 shadow-sm"
                                            >
                                                <p className="text-[13px] font-bold text-[#4F6F52]">
                                                    {getReadableFieldLabel(
                                                        item.key,
                                                        item.label,
                                                    )}
                                                </p>

                                                <div className="mt-3 grid grid-cols-1 gap-3">
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                            Sebelum
                                                        </p>

                                                        <div className="mt-[4px] rounded-[10px] bg-[#F8FAF6] px-3 py-2 text-[11px] text-[#4B4B4B]">
                                                            <AuditValue
                                                                fieldKey={
                                                                    item.key
                                                                }
                                                                label={
                                                                    item.label
                                                                }
                                                                value={
                                                                    item.old_value
                                                                }
                                                                compact
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                            Sesudah
                                                        </p>

                                                        <div className="mt-[4px] rounded-[10px] bg-[#F8FAF6] px-3 py-2 text-[11px] text-[#4B4B4B]">
                                                            <AuditValue
                                                                fieldKey={
                                                                    item.key
                                                                }
                                                                label={
                                                                    item.label
                                                                }
                                                                value={
                                                                    item.new_value
                                                                }
                                                                compact
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </section>
                    )}

                    {activityMode === 'create' && (
                        <ValueList
                            title="Data Baru"
                            items={detail.new_items}
                            emptyText="Tidak ada data baru yang tercatat."
                        />
                    )}

                    {activityMode === 'delete' && (
                        <ValueList
                            title="Data Dihapus"
                            items={detail.old_items}
                            emptyText="Tidak ada data yang terhapus tercatat."
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default ActivityHistoryDetail;