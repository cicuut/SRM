'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '@/components/sidebar';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const FINANCIAL_ALLOWED_ROLES = ['admin', 'midwife'];

type MeResponse = {
    msg?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role: string;
        clinic_id?: string | null;
    };
};

type MedicalRecordOption = {
    rm_id: string;
    record_number: string;
    record_type: string;
    patient_name: string;
    nik: string;
    birth_date: string;
    status: string;
    created_at: string;
    updated_at: string;
};

type FinancialDetail = {
    transaction_id: string;
    visit_id: string | null;
    record_id?: string | null;
    patient_id: string;
    transaction_number: string;
    trans_id: string;
    payment_date: string;
    trans_type: string;
    amount: number;
    payment_method: string;
    status: string;
    description: string;
    visit_display: string;
    visit_number?: string;
    record_number: string;
    record_type: string;
    patient_name: string;
    patient_number?: string;
    user_name: string;
};

type DetailFormData = {
    transaction_number: string;
    payment_date: string;
    visit_id: string;
    trans_type: string;
    amount: string;
    payment_method: string;
    status: string;
    description: string;
};

const inputClassName =
    'mt-[8px] h-[34px] w-full rounded-[4px] border border-transparent bg-white px-3 text-[13px] text-black shadow-md outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

const selectClassName =
    'mt-[8px] h-[34px] w-full rounded-[4px] border border-transparent bg-white px-3 text-[13px] text-black shadow-md outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number(value || 0));
};

const DetailInvoicePage = () => {
    const router = useRouter();
    const params = useParams();

    const transactionId = String(params.transactionId || '');

    const [medicalRecords, setMedicalRecords] = useState<MedicalRecordOption[]>(
        [],
    );

    const [detail, setDetail] = useState<FinancialDetail | null>(null);

    const [formData, setFormData] = useState<DetailFormData>({
        transaction_number: '',
        payment_date: '',
        visit_id: '',
        trans_type: 'pemasukan',
        amount: '',
        payment_method: 'Transfer',
        status: 'paid',
        description: '',
    });

    const [hasAccess, setHasAccess] = useState(false);
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const selectedRecord = useMemo(() => {
        return medicalRecords.find(
            (record) => record.rm_id === formData.visit_id,
        );
    }, [medicalRecords, formData.visit_id]);

    const getToken = () => {
        return Cookies.get('access_token');
    };

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

    const handleForbidden = () => {
        router.replace('/dashboard');
    };

    const checkFinancialAccess = async () => {
        try {
            setIsCheckingAccess(true);
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

            const data = (await readJson(response)) as MeResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok || !data.user) {
                throw new Error(data?.msg || 'Gagal mengecek akses user');
            }

            if (!FINANCIAL_ALLOWED_ROLES.includes(data.user.role)) {
                handleForbidden();
                return;
            }

            setHasAccess(true);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengecek akses';

            setErrorMessage(message);
        } finally {
            setIsCheckingAccess(false);
        }
    };

    const fetchMedicalRecords = async () => {
        try {
            setIsLoadingRecords(true);

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/medical-record/get-all-records`,
                {
                    method: 'GET',
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

            if (!response.ok) {
                throw new Error(
                    data?.msg || 'Gagal mengambil data medical record',
                );
            }

            setMedicalRecords(Array.isArray(data) ? data : []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil medical record';

            setErrorMessage(message);
        } finally {
            setIsLoadingRecords(false);
        }
    };

    const fetchFinancialDetail = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');
            setSuccessMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/financial/detail/${transactionId}`,
                {
                    method: 'GET',
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

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            if (!response.ok || !data?.data) {
                throw new Error(data?.msg || 'Gagal mengambil detail invoice');
            }

            const invoice = data.data as FinancialDetail;

            setDetail(invoice);
            setFormData({
                transaction_number: invoice.transaction_number || '',
                payment_date: invoice.payment_date || '',
                visit_id: invoice.record_id || invoice.visit_id || '',
                trans_type: invoice.trans_type || 'pemasukan',
                amount: String(invoice.amount || ''),
                payment_method: invoice.payment_method || 'Transfer',
                status: invoice.status || 'paid',
                description: invoice.description || '',
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil detail invoice';

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

        fetchMedicalRecords();
        fetchFinancialDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess, transactionId]);

    const handleChange = (
        event:
            | React.ChangeEvent<HTMLInputElement>
            | React.ChangeEvent<HTMLSelectElement>
            | React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
        const { name, value } = event.target;

        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const validateForm = () => {
        if (!formData.payment_date) {
            return 'Date wajib diisi';
        }

        if (!formData.visit_id) {
            return 'Recorder wajib dipilih';
        }

        if (!['pemasukan', 'pengeluaran'].includes(formData.trans_type)) {
            return 'Transaction type tidak valid';
        }

        if (!formData.amount || Number(formData.amount) <= 0) {
            return 'Total amount harus lebih dari 0';
        }

        if (!['Transfer', 'QRIS', 'Cash'].includes(formData.payment_method)) {
            return 'Payment method tidak valid';
        }

        if (!['paid', 'unpaid'].includes(formData.status)) {
            return 'Status tidak valid';
        }

        return '';
    };

    const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
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

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/financial/detail/${transactionId}`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        payment_date: formData.payment_date,
                        visit_id: formData.visit_id,
                        trans_type: formData.trans_type,
                        amount: Number(formData.amount),
                        payment_method: formData.payment_method,
                        status: formData.status,
                        description: formData.description,
                    }),
                },
            );

            const data = await readJson(response);

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            if (!response.ok || !data?.data) {
                throw new Error(data?.msg || 'Gagal menyimpan perubahan');
            }

            const updatedInvoice = data.data as FinancialDetail;

            setDetail(updatedInvoice);
            setFormData({
                transaction_number: updatedInvoice.transaction_number || '',
                payment_date: updatedInvoice.payment_date || '',
                visit_id: updatedInvoice.record_id || updatedInvoice.visit_id || '',
                trans_type: updatedInvoice.trans_type || 'pemasukan',
                amount: String(updatedInvoice.amount || ''),
                payment_method: updatedInvoice.payment_method || 'Transfer',
                status: updatedInvoice.status || 'paid',
                description: updatedInvoice.description || '',
            });

            setSuccessMessage('Invoice berhasil diperbarui');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat menyimpan perubahan';

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

            const response = await fetch(
                `${API_BASE_URL}/financial/detail/${transactionId}`,
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

            if (response.status === 403) {
                handleForbidden();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal menghapus invoice');
            }

            router.push('/financial-report');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat menghapus invoice';

            setErrorMessage(message);
            setShowDeleteConfirm(false);
        } finally {
            setIsDeleting(false);
        }
    };

    if (isCheckingAccess || isLoading) {
        return (
            <div className="flex min-h-screen w-full overflow-x-auto bg-[#FDFEF9]">
                <Sidebar />

                <main className="flex min-h-screen min-w-0 flex-1 items-center justify-center bg-[#FDFEF9] pb-[40px] pl-[28px] pr-[28px] pt-[26px]">
                    <p className="text-[14px] font-bold text-[#5F785F]">
                        Loading invoice detail...
                    </p>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full overflow-x-auto bg-[#FDFEF9]">
            <Sidebar />

            <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-[#FDFEF9] pb-[40px] pl-[28px] pr-[28px] pt-[26px]">
                <div className="w-full">
                    <div className="mt-[40px] rounded-[18px] bg-[#86A789] px-6 py-6 shadow-md">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                                    Invoice Detail
                                </p>

                                <h1 className="mt-[10px] text-[28px] font-bold leading-none text-white">
                                    {formData.transaction_number || 'Invoice'}
                                </h1>

                                <p className="mt-[10px] text-[12px] font-medium text-white/90">
                                    Edit detail invoice, simpan perubahan, atau
                                    hapus transaksi.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => router.push('/financial-report')}
                                className="h-[38px] rounded-[50px] bg-white px-5 text-[12px] font-bold text-[#5F785F] shadow-sm transition-all hover:bg-[#F4F4F4]"
                            >
                                Back to Financial
                            </button>
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="mt-[18px] rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
                            {errorMessage}
                        </div>
                    )}

                    {successMessage && (
                        <div className="mt-[18px] rounded-[8px] border border-green-200 bg-green-50 px-4 py-3 text-[12px] font-medium text-green-700">
                            {successMessage}
                        </div>
                    )}

                    <form
                        onSubmit={handleSave}
                        className="mt-[26px] w-full max-w-[980px] rounded-[14px] border border-[#D2D8CF] bg-[#EEF3E9] px-6 py-6 shadow-sm"
                    >
                        <div className="grid grid-cols-1 gap-x-[48px] gap-y-[20px] md:grid-cols-3">
                            <label className="block">
                                <span className="text-[14px] font-bold text-black">
                                    Invoice No
                                </span>

                                <input
                                    type="text"
                                    name="transaction_number"
                                    value={formData.transaction_number}
                                    readOnly
                                    className={`${inputClassName} cursor-not-allowed bg-[#F4F4F4] text-[#6B6B6B]`}
                                />
                            </label>

                            <label className="block">
                                <span className="text-[14px] font-bold text-black">
                                    Date
                                </span>

                                <input
                                    type="date"
                                    name="payment_date"
                                    value={formData.payment_date}
                                    onChange={handleChange}
                                    required
                                    className={inputClassName}
                                />
                            </label>

                            <label className="block">
                                <span className="text-[14px] font-bold text-black">
                                    Recorder
                                </span>

                                <select
                                    name="visit_id"
                                    value={formData.visit_id}
                                    onChange={handleChange}
                                    required
                                    className={selectClassName}
                                >
                                    <option value="">
                                        {isLoadingRecords
                                            ? 'Loading records...'
                                            : 'Select recorder'}
                                    </option>

                                    {medicalRecords.map((record) => (
                                        <option
                                            key={record.rm_id}
                                            value={record.rm_id}
                                        >
                                            {record.patient_name} -{' '}
                                            {record.record_number}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-[14px] font-bold text-black">
                                    Transaction Type
                                </span>

                                <select
                                    name="trans_type"
                                    value={formData.trans_type}
                                    onChange={handleChange}
                                    required
                                    className={selectClassName}
                                >
                                    <option value="pemasukan">Pemasukan</option>
                                    <option value="pengeluaran">
                                        Pengeluaran
                                    </option>
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-[14px] font-bold text-black">
                                    Total Amount
                                </span>

                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    min="0"
                                    required
                                    className={inputClassName}
                                />
                            </label>

                            <label className="block">
                                <span className="text-[14px] font-bold text-black">
                                    Payment Method
                                </span>

                                <select
                                    name="payment_method"
                                    value={formData.payment_method}
                                    onChange={handleChange}
                                    required
                                    className={selectClassName}
                                >
                                    <option value="Transfer">Transfer</option>
                                    <option value="QRIS">QRIS</option>
                                    <option value="Cash">Cash</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-[14px] font-bold text-black">
                                    Status
                                </span>

                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    required
                                    className={selectClassName}
                                >
                                    <option value="paid">Paid</option>
                                    <option value="unpaid">Unpaid</option>
                                </select>
                            </label>

                            <div className="rounded-[12px] bg-white px-4 py-4 text-[12px] text-[#4B4B4B] shadow-sm md:col-span-2">
                                <p>
                                    <span className="font-bold">Patient:</span>{' '}
                                    {selectedRecord?.patient_name ||
                                        detail?.patient_name ||
                                        '-'}
                                </p>

                                <p className="mt-1">
                                    <span className="font-bold">Record:</span>{' '}
                                    {selectedRecord?.record_number ||
                                        detail?.record_number ||
                                        '-'}
                                </p>

                                <p className="mt-1">
                                    <span className="font-bold">Type:</span>{' '}
                                    {selectedRecord?.record_type ||
                                        detail?.record_type ||
                                        '-'}
                                </p>

                                <p className="mt-1">
                                    <span className="font-bold">Amount:</span>{' '}
                                    {formatRupiah(Number(formData.amount || 0))}
                                </p>
                            </div>
                        </div>

                        <div className="mt-[28px]">
                            <label className="block">
                                <span className="text-[14px] font-bold text-black">
                                    Description
                                </span>

                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={7}
                                    className="mt-[14px] w-full rounded-[4px] border border-transparent bg-white px-4 py-3 text-[13px] text-black shadow-md outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                />
                            </label>
                        </div>

                        <div className="mt-[36px] flex flex-wrap items-center gap-[12px]">
                            <button
                                type="submit"
                                disabled={isSaving || isDeleting}
                                className="min-w-[130px] rounded-[50px] bg-[#86A789] px-6 py-2 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isSaving || isDeleting}
                                className="min-w-[100px] rounded-[50px] bg-red-600 px-6 py-2 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Delete
                            </button>

                            <button
                                type="button"
                                onClick={() => router.push('/financial-report')}
                                disabled={isSaving || isDeleting}
                                className="min-w-[100px] rounded-[50px] border border-[#BFC7BB] bg-white px-6 py-2 text-[12px] font-semibold text-[#4B4B4B] shadow-sm transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </main>

            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-[420px] rounded-[18px] bg-white px-6 py-6 shadow-xl">
                        <h2 className="text-[20px] font-bold text-black">
                            Delete Invoice?
                        </h2>

                        <p className="mt-[12px] text-[13px] leading-relaxed text-[#4B4B4B]">
                            Invoice{' '}
                            <span className="font-bold">
                                {formData.transaction_number}
                            </span>{' '}
                            akan dihapus dari financial report. Aksi ini tidak
                            bisa dibatalkan.
                        </p>

                        <div className="mt-[24px] flex flex-wrap justify-end gap-[10px]">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="rounded-[50px] border border-[#BFC7BB] bg-white px-5 py-2 text-[12px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4] disabled:opacity-60"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="rounded-[50px] bg-red-600 px-5 py-2 text-[12px] font-bold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetailInvoicePage;