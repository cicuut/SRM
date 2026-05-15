'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

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
    clinic?: {
        id: string;
        clinic_name: string;
    } | null;
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

type InvoiceFormData = {
    payment_date: string;
    visit_id: string;
    trans_type: string;
    amount: string;
    payment_method: string;
    status: string;
    description: string;
};

const getTodayInputValue = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

    return date.toISOString().split('T')[0];
};

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const formatRupiah = (value: string | number) => {
    const numericValue = Number(value || 0);

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number.isNaN(numericValue) ? 0 : numericValue);
};

const inputClassName =
    'mt-2 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70';

const selectClassName =
    'mt-2 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70';

const labelClassName = 'text-[12px] font-bold text-[#2F3A2F]';

const AddInvoice = () => {
    const router = useRouter();

    const [transactionNumber, setTransactionNumber] = useState('');
    const [medicalRecords, setMedicalRecords] = useState<MedicalRecordOption[]>(
        [],
    );

    const [formData, setFormData] = useState<InvoiceFormData>({
        payment_date: getTodayInputValue(),
        visit_id: '',
        trans_type: 'pemasukan',
        amount: '',
        payment_method: 'Transfer',
        status: 'paid',
        description: '',
    });

    const [hasAccess, setHasAccess] = useState(false);
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

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
                throw new Error(data?.msg || 'Gagal mengecek akses pengguna');
            }

            if (!FINANCIAL_ALLOWED_ROLES.includes(data.user.role)) {
                handleForbidden();
                return;
            }

            localStorage.setItem('user_id', data.user.id || '');
            localStorage.setItem('fullname', data.user.fullname || '');
            localStorage.setItem('user_email', data.user.email || '');
            localStorage.setItem('user_role', data.user.role || '');
            localStorage.setItem('clinic_id', data.user.clinic_id || '');

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

    const fetchTransactionNumber = async (date: string) => {
        try {
            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/financial/transaction-number?date=${encodeURIComponent(
                    date,
                )}`,
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

            if (!response.ok) {
                throw new Error(
                    data?.msg || 'Gagal membuat nomor transaksi',
                );
            }

            setTransactionNumber(data.transaction_number || '');
        } catch {
            const year = date.split('-')[0] || new Date().getFullYear();

            setTransactionNumber(`INV-${year}----`);
        }
    };

    const fetchMedicalRecords = async () => {
        try {
            setIsLoadingRecords(true);
            setErrorMessage('');

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
                    data?.msg || 'Gagal mengambil data rekam medis',
                );
            }

            setMedicalRecords(Array.isArray(data) ? data : []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil data rekam medis';

            setErrorMessage(message);
        } finally {
            setIsLoadingRecords(false);
        }
    };

    useEffect(() => {
        checkFinancialAccess();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!hasAccess) return;

        fetchMedicalRecords();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess]);

    useEffect(() => {
        if (!hasAccess) return;

        fetchTransactionNumber(formData.payment_date);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess, formData.payment_date]);

    const handleChange = (
        event:
            | ChangeEvent<HTMLInputElement>
            | ChangeEvent<HTMLSelectElement>
            | ChangeEvent<HTMLTextAreaElement>,
    ) => {
        const { name, value } = event.target;

        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const validateForm = () => {
        if (!formData.payment_date) {
            return 'Tanggal wajib diisi.';
        }

        if (!formData.visit_id) {
            return 'Rekam medis wajib dipilih.';
        }

        if (!formData.trans_type) {
            return 'Tipe transaksi wajib dipilih.';
        }

        if (!['pemasukan', 'pengeluaran'].includes(formData.trans_type)) {
            return 'Tipe transaksi tidak valid.';
        }

        if (!formData.amount || Number(formData.amount) <= 0) {
            return 'Nominal harus lebih dari 0.';
        }

        if (!formData.payment_method) {
            return 'Metode pembayaran wajib dipilih.';
        }

        if (!['Transfer', 'QRIS', 'Cash'].includes(formData.payment_method)) {
            return 'Metode pembayaran tidak valid.';
        }

        if (!formData.status) {
            return 'Status pembayaran wajib dipilih.';
        }

        if (!['paid', 'unpaid'].includes(formData.status)) {
            return 'Status pembayaran tidak valid.';
        }

        return '';
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setIsSubmitting(true);
            setErrorMessage('');

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

            const response = await fetch(`${API_BASE_URL}/financial/add`, {
                method: 'POST',
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
                    description: formData.description.trim(),
                }),
            });

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
                throw new Error(data?.msg || 'Gagal menambahkan invoice');
            }

            router.push('/financial-report');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat menambahkan invoice';

            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isCheckingAccess) {
        return (
            <div className="flex min-h-[calc(100dvh-150px)] w-full items-center justify-center">
                <p className="text-[14px] font-bold text-[#5F785F]">
                    Memeriksa akses laporan keuangan...
                </p>
            </div>
        );
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#D2D8CF] bg-white px-5 py-4 shadow-sm">
                <div>
                    <h1 className="text-[20px] font-bold text-[#4F6F52]">
                        Tambah Invoice
                    </h1>

                    <p className="mt-1 text-[12px] text-[#6B6B6B]">
                        Isi data invoice baru untuk laporan keuangan klinik.
                    </p>
                </div>

                <div className="rounded-[10px] bg-[#F8FAF6] px-4 py-3 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#739072]">
                        Nomor Invoice
                    </p>

                    <p className="mt-1 text-[14px] font-bold text-[#2F3A2F]">
                        {transactionNumber || 'INV-----'}
                    </p>
                </div>
            </div>

            {errorMessage && (
                <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
                    {errorMessage}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="rounded-[14px] border border-[#D2D8CF] bg-white shadow-sm"
            >
                <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2">
                    <label className="block">
                        <span className={labelClassName}>Tanggal</span>

                        <input
                            type="date"
                            name="payment_date"
                            value={formData.payment_date}
                            onChange={handleChange}
                            required
                            disabled={isSubmitting}
                            className={inputClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={labelClassName}>Rekam Medis</span>

                        <select
                            name="visit_id"
                            value={formData.visit_id}
                            onChange={handleChange}
                            required
                            disabled={isSubmitting || isLoadingRecords}
                            className={selectClassName}
                        >
                            <option value="">
                                {isLoadingRecords
                                    ? 'Memuat data...'
                                    : 'Pilih rekam medis'}
                            </option>

                            {medicalRecords.map((record) => (
                                <option key={record.rm_id} value={record.rm_id}>
                                    {record.patient_name} -{' '}
                                    {record.record_number} ({record.record_type})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className={labelClassName}>Tipe Transaksi</span>

                        <select
                            name="trans_type"
                            value={formData.trans_type}
                            onChange={handleChange}
                            required
                            disabled={isSubmitting}
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
                            min="0"
                            required
                            disabled={isSubmitting}
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
                            disabled={isSubmitting}
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
                            disabled={isSubmitting}
                            className={selectClassName}
                        >
                            <option value="paid">Paid</option>
                            <option value="unpaid">Unpaid</option>
                        </select>
                    </label>

                    <label className="block md:col-span-2">
                        <span className={labelClassName}>Deskripsi</span>

                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            disabled={isSubmitting}
                            placeholder="Tambahkan keterangan jika diperlukan"
                            className="mt-2 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                    </label>

                    <div className="rounded-[10px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-3 md:col-span-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-[#6B6B6B]">
                                    Pasien
                                </p>

                                <p className="mt-1 text-[13px] font-bold text-[#2F3A2F]">
                                    {selectedRecord
                                        ? `${selectedRecord.patient_name} - ${selectedRecord.record_number}`
                                        : 'Belum dipilih'}
                                </p>
                            </div>

                            <div className="text-left sm:text-right">
                                <p className="text-[11px] font-bold text-[#6B6B6B]">
                                    Total
                                </p>

                                <p className="mt-1 text-[16px] font-bold text-[#2F3A2F]">
                                    {formatRupiah(formData.amount)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-[#E4E8E1] px-5 py-4 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => router.push('/financial-report')}
                        disabled={isSubmitting}
                        className="h-[38px] rounded-[30px] border border-[#BFC7BB] bg-white px-5 text-[12px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Batal
                    </button>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-[38px] rounded-[30px] bg-[#739072] px-5 text-[12px] font-bold text-white hover:bg-[#5F785F] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting ? 'Menyimpan...' : 'Simpan Invoice'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddInvoice;