'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import LoadingOverlay from '@/components/loading';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
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
    if (!value) return '-';

    if (value === 'asisten') return 'Asisten';

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

const DetailField = ({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) => {
    return (
        <div className="min-w-0">
            <p className="text-[11px] font-bold text-black">{label}</p>

            <div className="mt-[8px] min-h-[42px] rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-4 py-3 text-[13px] font-medium text-[#4B4B4B]">
                <p className="break-words">{value || '-'}</p>
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
                        {items.map((item) => (
                            <DetailField
                                key={`${item.key}-${item.label}`}
                                label={item.label}
                                value={item.value}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

const ActivityHistoryDetail = () => {
    const router = useRouter();
    const params = useParams();

    const auditId = useMemo(() => {
        const value = params?.auditId;

        if (Array.isArray(value)) {
            return value[0] || '';
        }

        return value || '';
    }, [params]);

    const [detail, setDetail] = useState<ActivityDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const clearSession = () => {
        Cookies.remove('access_token');

        localStorage.removeItem('user_id');
        localStorage.removeItem('fullname');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('clinic_id');
    };

    const handleUnauthorized = () => {
        clearSession();
        router.push('/login');
    };

    const fetchDetail = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');

            const token = Cookies.get('access_token');

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/activity-history/detail/${auditId}`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            const data = (await readJson(response)) as DetailResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                router.push('/dashboard');
                return;
            }

            if (!response.ok || !data.data) {
                throw new Error(data?.msg || 'Gagal mengambil detail activity');
            }

            setDetail(data.data);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil detail activity';

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
                    Detail activity tidak ditemukan.
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
                                label="Audit ID"
                                value={detail.audit_number}
                            />

                            <DetailField
                                label="Tanggal"
                                value={formatDateTime(detail.date_time)}
                            />

                            <DetailField
                                label="Module"
                                value={detail.module}
                            />

                            <DetailField
                                label="Record ID"
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
                                label="Action"
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
                                                                {item.label}
                                                            </td>

                                                            <td className="px-4 py-4">
                                                                <div className="mx-auto max-w-[360px] whitespace-pre-wrap break-words text-left">
                                                                    {item.old_value ||
                                                                        '-'}
                                                                </div>
                                                            </td>

                                                            <td className="px-4 py-4">
                                                                <div className="mx-auto max-w-[360px] whitespace-pre-wrap break-words text-left">
                                                                    {item.new_value ||
                                                                        '-'}
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
                                                    {item.label}
                                                </p>

                                                <div className="mt-3 grid grid-cols-1 gap-3">
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                            Sebelum
                                                        </p>

                                                        <p className="mt-[4px] whitespace-pre-wrap break-words rounded-[10px] bg-[#F8FAF6] px-3 py-2 text-[11px] text-[#4B4B4B]">
                                                            {item.old_value ||
                                                                '-'}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                                                            Sesudah
                                                        </p>

                                                        <p className="mt-[4px] whitespace-pre-wrap break-words rounded-[10px] bg-[#F8FAF6] px-3 py-2 text-[11px] text-[#4B4B4B]">
                                                            {item.new_value ||
                                                                '-'}
                                                        </p>
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