'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import LoadingOverlay from '@/components/loading';
import api from '@/utils/app';


const FINANCIAL_ALLOWED_ROLES = ['admin', 'midwife'] as const;

type Role = 'admin' | 'midwife' | 'asisten' | '';

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
    };
};

type FinancialDetail = {
    transaction_id: string;
    visit_id: string | null;
    record_id?: string | null;
    patient_id?: string | null;
    clinic_id?: string | null;
    user_id?: string | null;
    transaction_number: string;
    trans_id?: string;
    payment_date: string;
    trans_type: string;
    amount: number;
    payment_method: string;
    status: string;
    description: string;
    visit_display?: string;
    visit_number?: string;
    visit_date?: string | null;
    record_number: string;
    record_type: string;
    patient_name: string;
    patient_number?: string;
    user_name: string;
};

type DetailFormData = {
    transaction_number: string;
    payment_date: string;
    trans_type: string;
    amount: string;
    payment_method: string;
    status: string;
    description: string;
};

const inputClassName =
    'mt-2 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70';

const selectClassName =
    'mt-2 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70';

const readonlyClassName =
    'mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none';

const textareaClassName =
    'mt-2 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70';

const labelClassName = 'text-[12px] font-bold text-[#2F3A2F]';

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const normalizeRole = (role?: string | null): Role => {
    const normalizedRole = String(role || '').trim().toLowerCase();

    if (normalizedRole === 'admin') return 'admin';
    if (normalizedRole === 'developer') return 'admin';

    if (normalizedRole === 'midwife') return 'midwife';
    if (normalizedRole === 'bidan') return 'midwife';
    if (normalizedRole === 'owner') return 'midwife';

    if (normalizedRole === 'asisten') return 'asisten';
    if (normalizedRole === 'assistant') return 'asisten';
    if (normalizedRole === 'staff') return 'asisten';

    return '';
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

    if (normalizedMessage.includes('network error')) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    if (normalizedMessage.includes('only admin or midwife')) {
        return 'Hanya admin atau bidan yang dapat mengakses fitur ini.';
    }

    if (normalizedMessage.includes('only admin')) {
        return 'Hanya admin yang dapat mengakses fitur ini.';
    }

    if (normalizedMessage.includes('only midwife')) {
        return 'Hanya bidan yang dapat mengakses fitur ini.';
    }

    if (normalizedMessage.includes('forbidden')) {
        return 'Kamu tidak memiliki izin untuk mengakses halaman ini.';
    }

    if (normalizedMessage.includes('invoice not found')) {
        return 'Invoice tidak ditemukan.';
    }

    if (normalizedMessage.includes('financial')) {
        return rawMessage
            .replace('Failed to', 'Gagal')
            .replace('failed to', 'gagal');
    }

    return rawMessage;
};

const ForbiddenView = () => {
    return (
        <div className="flex min-h-[calc(100dvh-150px)] w-full items-center justify-center px-4">
            <div className="w-full max-w-[460px] rounded-[24px] border border-red-200 bg-white px-6 py-8 text-center shadow-sm">
                <div className="mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-full bg-red-50 text-[24px] font-extrabold text-red-600">
                    403
                </div>

                <h1 className="mt-5 text-[24px] font-extrabold text-[#2F3A2F]">
                    Forbidden Access
                </h1>

                <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#6B6B6B]">
                    Kamu tidak memiliki izin untuk mengakses detail invoice
                    keuangan.
                </p>

                <p className="mt-2 text-[12px] font-semibold text-red-600">
                    Halaman ini hanya dapat diakses oleh admin dan bidan.
                </p>
            </div>
        </div>
    );
};

const normalizeDateInput = (value?: string | null) => {
    if (!value) return '';

    return value.includes('T') ? value.split('T')[0] : value;
};

const formatRupiah = (value: string | number) => {
    const numericValue = Number(value || 0);

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number.isNaN(numericValue) ? 0 : numericValue);
};

const formatDateDisplay = (value?: string | null) => {
    if (!value || value === '-') return '-';

    const normalizedDate = normalizeDateInput(value);
    const date = new Date(`${normalizedDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return normalizedDate;
    }

    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
};

const formatTransactionType = (value: string) => {
    if (value === 'pemasukan') return 'Pemasukan';
    if (value === 'pengeluaran') return 'Pengeluaran';

    return value || '-';
};

const formatPaymentStatus = (value: string) => {
    if (value === 'paid') return 'Dibayar';
    if (value === 'unpaid') return 'Belum Dibayar';

    return value || '-';
};

const getStatusBadgeClassName = (status: string) => {
    if (status === 'paid') {
        return 'bg-[#D2E3C8] text-[#4F6F52]';
    }

    if (status === 'unpaid') {
        return 'bg-red-50 text-red-600';
    }

    return 'bg-[#F2F2F2] text-[#5F5F5F]';
};

const createFormFromDetail = (invoice: FinancialDetail): DetailFormData => {
    return {
        transaction_number: invoice.transaction_number || '',
        payment_date: normalizeDateInput(invoice.payment_date || ''),
        trans_type: invoice.trans_type || 'pemasukan',
        amount: String(invoice.amount || ''),
        payment_method: invoice.payment_method || 'Transfer',
        status: invoice.status || 'paid',
        description: invoice.description || '',
    };
};

const DetailInvoicePage = () => {
    const router = useRouter();
    const params = useParams();

    const transactionId = String(params.transactionId || '');

    const [detail, setDetail] = useState<FinancialDetail | null>(null);
    const [formData, setFormData] = useState<DetailFormData>({
        transaction_number: '',
        payment_date: '',
        trans_type: 'pemasukan',
        amount: '',
        payment_method: 'Transfer',
        status: 'paid',
        description: '',
    });

    const [originalFormData, setOriginalFormData] =
        useState<DetailFormData | null>(null);

    const [hasAccess, setHasAccess] = useState(false);
    const [isForbidden, setIsForbidden] = useState(false);
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const showLoadingOverlay =
        isCheckingAccess || isLoading || isSaving || isDeleting;

    const isChanged = useMemo(() => {
        if (!originalFormData) return false;

        return JSON.stringify(originalFormData) !== JSON.stringify(formData);
    }, [formData, originalFormData]);

    const getToken = () => {
        return Cookies.get('access_token');
    };

    const clearSession = () => {
        Cookies.remove('access_token', { path: '/' });

        if (typeof window === 'undefined') return;

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

    const handleForbidden = () => {
        setHasAccess(false);
        setIsForbidden(true);
        setIsLoading(false);
        setIsCheckingAccess(false);
    };

    const checkFinancialAccess = async () => {
        try {
            setIsCheckingAccess(true);
            setErrorMessage('');
            setIsForbidden(false);

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
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
                return;
            }

            if (response.status !== 200 || !data.user) {
                throw new Error(data?.msg || 'Gagal mengecek akses pengguna.');
            }

            const userRole = normalizeRole(data.user.role || data.user.user_role);

            if (
                userRole === 'midwife' &&
                data.requires_clinic_setup &&
                !data.user.clinic_id
            ) {
                router.push(data.redirect_path || '/register-clinic');
                return;
            }

            if (!FINANCIAL_ALLOWED_ROLES.includes(userRole as 'admin' | 'midwife')) {
                handleForbidden();
                return;
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem('user_id', data.user.id || '');
                localStorage.setItem('temp_user_id', data.user.id || '');
                localStorage.setItem('fullname', data.user.fullname || '');
                localStorage.setItem('user_email', data.user.email || '');
                localStorage.setItem('user_role', userRole || '');
                localStorage.setItem('clinic_id', data.user.clinic_id || '');
                localStorage.setItem(
                    'requires_clinic_setup',
                    data.requires_clinic_setup ? 'true' : 'false',
                );
            }

            setHasAccess(true);
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Terjadi kesalahan saat mengecek akses.';

            setErrorMessage(message);
        } finally {
            setIsCheckingAccess(false);
        }
    };

    const fetchFinancialDetail = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');
            setSuccessMessage('');

            if (!transactionId) {
                throw new Error('Invoice tidak ditemukan.');
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.get(`/financial/detail/${transactionId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = response.data;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            const invoice = (data?.data || data) as FinancialDetail;

            if (response.status !== 200 || !invoice?.transaction_id) {
                throw new Error(data?.msg || 'Gagal mengambil detail invoice.');
            }

            const nextFormData = createFormFromDetail(invoice);

            setDetail(invoice);
            setFormData(nextFormData);
            setOriginalFormData(nextFormData);
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Terjadi kesalahan saat mengambil detail invoice.';

            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkFinancialAccess();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!hasAccess) return;

        fetchFinancialDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess, transactionId]);

    const handleChange = (
        event:
            | ChangeEvent<HTMLInputElement>
            | ChangeEvent<HTMLSelectElement>
            | ChangeEvent<HTMLTextAreaElement>,
    ) => {
        const { name, value } = event.target;

        setSuccessMessage('');

        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const validateForm = () => {
        if (!formData.payment_date) {
            return 'Tanggal pembayaran wajib diisi.';
        }

        if (!['pemasukan', 'pengeluaran'].includes(formData.trans_type)) {
            return 'Tipe transaksi tidak valid.';
        }

        if (!formData.amount || Number(formData.amount) <= 0) {
            return 'Nominal harus lebih dari 0.';
        }

        if (!['Transfer', 'QRIS', 'Cash'].includes(formData.payment_method)) {
            return 'Metode pembayaran tidak valid.';
        }

        if (!['paid', 'unpaid'].includes(formData.status)) {
            return 'Status pembayaran tidak valid.';
        }

        return '';
    };

    const handleSave = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setIsSaving(true);
            setErrorMessage('');
            setSuccessMessage('');

            const validationMessage = validateForm();

            if (validationMessage) {
                setErrorMessage(validationMessage);
                return;
            }

            if (!isChanged) {
                setSuccessMessage('Tidak ada perubahan yang perlu disimpan.');
                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.patch(`/financial/detail/${transactionId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    payment_date: formData.payment_date,
                    trans_type: formData.trans_type,
                    amount: Number(formData.amount),
                    payment_method: formData.payment_method,
                    status: formData.status,
                    description: formData.description.trim(),
                }),
            });

            const data = response.data;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            const updatedInvoice = (data?.data || data) as FinancialDetail;

            if (response.status !== 200 || !updatedInvoice?.transaction_id) {
                throw new Error(data?.msg || 'Gagal menyimpan perubahan.');
            }

            const nextFormData = createFormFromDetail(updatedInvoice);

            setDetail(updatedInvoice);
            setFormData(nextFormData);
            setOriginalFormData(nextFormData);
            setSuccessMessage('Perubahan invoice berhasil disimpan.');
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Terjadi kesalahan saat menyimpan perubahan.';

            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            setErrorMessage('');
            setSuccessMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.delete(`/financial/detail/${transactionId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    },
                },
            );

            const data = response.data;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            if (response.status !== 200) {
                throw new Error(data?.msg || 'Gagal menghapus invoice.');
            }

            router.push('/financial-report');
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Terjadi kesalahan saat menghapus invoice.';

            setErrorMessage(message);
            setShowDeleteConfirm(false);
        } finally {
            setIsDeleting(false);
        }
    };

    if (isForbidden) {
        return <ForbiddenView />;
    }

    if (isCheckingAccess || isLoading) {
        return (
            <div className="relative min-h-[calc(100dvh-150px)] w-full">
                <LoadingOverlay />
            </div>
        );
    }

    return (
        <>
            {showLoadingOverlay && <LoadingOverlay />}

            <div className="flex w-full min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#D2D8CF] bg-white px-5 py-4 shadow-sm">
                    <div>
                        <h1 className="text-[20px] font-bold text-[#4F6F52]">
                            Detail Invoice
                        </h1>

                        <p className="mt-1 text-[12px] text-[#6B6B6B]">
                            Kelola data pembayaran invoice.
                        </p>
                    </div>

                    <div className="rounded-[10px] bg-[#F8FAF6] px-4 py-3 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#739072]">
                            Total Invoice
                        </p>

                        <p className="mt-1 text-[16px] font-bold text-[#2F3A2F]">
                            {formatRupiah(formData.amount)}
                        </p>
                    </div>
                </div>

                {errorMessage && (
                    <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="rounded-[10px] border border-green-200 bg-green-50 px-4 py-3 text-[12px] text-green-700">
                        {successMessage}
                    </div>
                )}

                <form
                    onSubmit={handleSave}
                    className="rounded-[14px] border border-[#D2D8CF] bg-white shadow-sm"
                >
                    <div className="border-b border-[#E4E8E1] px-5 py-4">
                        <h2 className="text-[16px] font-bold text-[#4F6F52]">
                            Data Invoice
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
                        <label className="block">
                            <span className={labelClassName}>
                                Nomor Invoice
                            </span>

                            <input
                                type="text"
                                value={formData.transaction_number || '-'}
                                readOnly
                                className={readonlyClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={labelClassName}>
                                Tanggal Pembayaran
                            </span>

                            <input
                                type="date"
                                name="payment_date"
                                value={formData.payment_date}
                                onChange={handleChange}
                                required
                                disabled={isSaving || isDeleting}
                                className={inputClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={labelClassName}>
                                Tipe Transaksi
                            </span>

                            <select
                                name="trans_type"
                                value={formData.trans_type}
                                onChange={handleChange}
                                required
                                disabled={isSaving || isDeleting}
                                className={selectClassName}
                            >
                                <option value="pemasukan">Pemasukan</option>
                                <option value="pengeluaran">Pengeluaran</option>
                            </select>
                        </label>

                        <label className="block">
                            <span className={labelClassName}>Nominal</span>

                            <input
                                type="number"
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                min="1"
                                required
                                disabled={isSaving || isDeleting}
                                placeholder="Masukkan nominal"
                                className={inputClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={labelClassName}>
                                Metode Pembayaran
                            </span>

                            <select
                                name="payment_method"
                                value={formData.payment_method}
                                onChange={handleChange}
                                required
                                disabled={isSaving || isDeleting}
                                className={selectClassName}
                            >
                                <option value="Transfer">Transfer</option>
                                <option value="QRIS">QRIS</option>
                                <option value="Cash">Cash</option>
                            </select>
                        </label>

                        <label className="block">
                            <span className={labelClassName}>
                                Status Pembayaran
                            </span>

                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                required
                                disabled={isSaving || isDeleting}
                                className={selectClassName}
                            >
                                <option value="paid">Dibayar</option>
                                <option value="unpaid">Belum Dibayar</option>
                            </select>
                        </label>

                        <div className="flex items-end">
                            <div
                                className={`inline-flex rounded-full px-3 py-2 text-[11px] font-bold ${getStatusBadgeClassName(
                                    formData.status,
                                )}`}
                            >
                                Status: {formatPaymentStatus(formData.status)}
                            </div>
                        </div>

                        <div className="flex items-end">
                            <div className="text-[12px] text-[#6B6B6B]">
                                <p className="font-bold text-[#2F3A2F]">
                                    {formatTransactionType(
                                        formData.trans_type,
                                    )}
                                </p>

                                <p>
                                    {formatDateDisplay(formData.payment_date)}
                                </p>
                            </div>
                        </div>

                        <label className="block md:col-span-2 xl:col-span-3">
                            <span className={labelClassName}>Deskripsi</span>

                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={4}
                                disabled={isSaving || isDeleting}
                                placeholder="Tambahkan keterangan jika diperlukan"
                                className={textareaClassName}
                            />
                        </label>
                    </div>

                    <div className="border-t border-[#E4E8E1] px-5 py-4">
                        <h2 className="text-[16px] font-bold text-[#4F6F52]">
                            Data Referensi
                        </h2>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <label className="block">
                                <span className={labelClassName}>Pasien</span>

                                <input
                                    type="text"
                                    value={detail?.patient_name || '-'}
                                    readOnly
                                    className={readonlyClassName}
                                />
                            </label>

                            <label className="block">
                                <span className={labelClassName}>
                                    No. Pasien
                                </span>

                                <input
                                    type="text"
                                    value={detail?.patient_number || '-'}
                                    readOnly
                                    className={readonlyClassName}
                                />
                            </label>

                            <label className="block">
                                <span className={labelClassName}>
                                    No. Rekam Medis
                                </span>

                                <input
                                    type="text"
                                    value={detail?.record_number || '-'}
                                    readOnly
                                    className={readonlyClassName}
                                />
                            </label>

                            <label className="block">
                                <span className={labelClassName}>
                                    Jenis Rekam Medis
                                </span>

                                <input
                                    type="text"
                                    value={detail?.record_type || '-'}
                                    readOnly
                                    className={readonlyClassName}
                                />
                            </label>

                            <label className="block">
                                <span className={labelClassName}>
                                    No. Kunjungan
                                </span>

                                <input
                                    type="text"
                                    value={
                                        detail?.visit_number ||
                                        detail?.visit_display ||
                                        '-'
                                    }
                                    readOnly
                                    className={readonlyClassName}
                                />
                            </label>

                            <label className="block">
                                <span className={labelClassName}>
                                    Tanggal Kunjungan
                                </span>

                                <input
                                    type="text"
                                    value={formatDateDisplay(
                                        detail?.visit_date || '',
                                    )}
                                    readOnly
                                    className={readonlyClassName}
                                />
                            </label>

                            <label className="block">
                                <span className={labelClassName}>
                                    Dibuat Oleh
                                </span>

                                <input
                                    type="text"
                                    value={detail?.user_name || '-'}
                                    readOnly
                                    className={readonlyClassName}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-[#E4E8E1] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={isSaving || isDeleting}
                            className="h-[38px] rounded-[30px] border border-red-200 bg-white px-5 text-[12px] font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Hapus Invoice
                        </button>

                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => router.push('/financial-report')}
                                disabled={isSaving || isDeleting}
                                className="h-[38px] rounded-[30px] border border-[#BFC7BB] bg-white px-5 text-[12px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Kembali
                            </button>

                            <button
                                type="submit"
                                disabled={isSaving || isDeleting || !isChanged}
                                className="h-[38px] rounded-[30px] bg-[#739072] px-5 text-[12px] font-bold text-white hover:bg-[#5F785F] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSaving
                                    ? 'Menyimpan...'
                                    : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-[420px] rounded-2xl bg-white px-6 py-6 shadow-xl">
                        <h2 className="text-[20px] font-bold text-[#2F3A2F]">
                            Hapus Invoice?
                        </h2>

                        <p className="mt-3 text-[13px] leading-relaxed text-[#4B4B4B]">
                            Invoice{' '}
                            <span className="font-bold">
                                {formData.transaction_number || '-'}
                            </span>{' '}
                            akan dihapus dari laporan keuangan. Aksi ini tidak
                            bisa dibatalkan.
                        </p>

                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="h-[38px] rounded-[30px] border border-[#BFC7BB] bg-white px-5 text-[12px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Batal
                            </button>

                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="h-[38px] rounded-[30px] bg-red-600 px-5 text-[12px] font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DetailInvoicePage;