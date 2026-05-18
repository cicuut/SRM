'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import LoadingOverlay from '@/components/loading';

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

type VisitReportOption = {
    visit_id: string;
    visit_date: string;
    visit_number: string;
    record_number: string;
    patient_name: string;
    nik: string;
    record_type: string;
    made_by: string;
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
    'mt-2 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:bg-[#F8FAF6] disabled:text-[#8A8A8A] disabled:opacity-70';

const selectClassName =
    'mt-2 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:bg-[#F8FAF6] disabled:text-[#8A8A8A] disabled:opacity-70';

const labelClassName = 'text-[12px] font-bold text-[#2F3A2F]';

const AddInvoice = () => {
    const router = useRouter();

    const [transactionNumber, setTransactionNumber] = useState('');
    const [visitReports, setVisitReports] = useState<VisitReportOption[]>([]);

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
    const [isLoadingVisits, setIsLoadingVisits] = useState(false);
    const [isLoadingTransactionNumber, setIsLoadingTransactionNumber] =
        useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');

    const isUnpaid = formData.status === 'unpaid';

    const showLoadingOverlay =
        isCheckingAccess ||
        isLoadingVisits ||
        isLoadingTransactionNumber ||
        isSubmitting;

    const selectedVisit = useMemo(() => {
        return visitReports.find(
            (visit) => visit.visit_id === formData.visit_id,
        );
    }, [visitReports, formData.visit_id]);

    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();

    const filteredVisitReports = useMemo(() => {
        if (!normalizedSearchKeyword) {
            return visitReports;
        }

        return visitReports.filter((visit) => {
            const searchableText = [
                visit.patient_name,
                visit.nik,
                visit.visit_number,
                visit.record_number,
                visit.record_type,
                visit.visit_date,
                visit.made_by,
            ]
                .join(' ')
                .toLowerCase();

            return searchableText.includes(normalizedSearchKeyword);
        });
    }, [visitReports, normalizedSearchKeyword]);

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
            setIsLoadingTransactionNumber(true);

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
        } finally {
            setIsLoadingTransactionNumber(false);
        }
    };

    const fetchVisitReports = async () => {
        try {
            setIsLoadingVisits(true);
            setErrorMessage('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/visit-report/get-all-visit`,
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
                    data?.msg || 'Gagal mengambil data laporan kunjungan',
                );
            }

            setVisitReports(Array.isArray(data) ? data : []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil data laporan kunjungan';

            setErrorMessage(message);
        } finally {
            setIsLoadingVisits(false);
        }
    };

    useEffect(() => {
        checkFinancialAccess();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!hasAccess) return;

        fetchVisitReports();
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

        setErrorMessage('');

        if (name === 'status') {
            setFormData((prevData) => ({
                ...prevData,
                status: value,
                amount: value === 'unpaid' ? '' : prevData.amount,
                payment_method:
                    value === 'unpaid'
                        ? ''
                        : prevData.payment_method || 'Transfer',
            }));

            return;
        }

        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleOpenVisitModal = () => {
        setSearchKeyword('');
        setIsVisitModalOpen(true);

        if (!isLoadingVisits && visitReports.length === 0) {
            fetchVisitReports();
        }
    };

    const handleCloseVisitModal = () => {
        setIsVisitModalOpen(false);
    };

    const handleSelectVisit = (visit: VisitReportOption) => {
        setFormData((prevData) => ({
            ...prevData,
            visit_id: visit.visit_id,
        }));

        setIsVisitModalOpen(false);
        setSearchKeyword('');
    };

    const validateForm = () => {
        if (!formData.payment_date) {
            return 'Tanggal wajib diisi.';
        }

        if (!formData.visit_id) {
            return 'Laporan kunjungan wajib dipilih.';
        }

        if (!formData.trans_type) {
            return 'Tipe transaksi wajib dipilih.';
        }

        if (!['pemasukan', 'pengeluaran'].includes(formData.trans_type)) {
            return 'Tipe transaksi tidak valid.';
        }

        if (!formData.status) {
            return 'Status pembayaran wajib dipilih.';
        }

        if (!['paid', 'unpaid'].includes(formData.status)) {
            return 'Status pembayaran tidak valid.';
        }

        if (formData.status === 'paid') {
            if (!formData.amount || Number(formData.amount) <= 0) {
                return 'Nominal harus lebih dari 0 untuk status paid.';
            }

            if (!formData.payment_method) {
                return 'Metode pembayaran wajib dipilih untuk status paid.';
            }

            if (!['Transfer', 'QRIS', 'Cash'].includes(formData.payment_method)) {
                return 'Metode pembayaran tidak valid.';
            }
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
                    amount: isUnpaid ? 0 : Number(formData.amount),
                    payment_method: isUnpaid ? null : formData.payment_method,
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
            <div className="relative flex min-h-[calc(100dvh-150px)] w-full items-center justify-center">
                <LoadingOverlay />
            </div>
        );
    }

    return (
        <div className="relative flex w-full min-w-0 flex-col gap-4">
            {showLoadingOverlay && <LoadingOverlay />}

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

                    <div className="block">
                        <span className={labelClassName}>
                            Laporan Kunjungan
                        </span>

                        <button
                            type="button"
                            onClick={handleOpenVisitModal}
                            disabled={isSubmitting || isLoadingVisits}
                            className="mt-2 flex min-h-[42px] w-full items-center justify-between gap-3 rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-2 text-left text-[13px] text-black outline-none transition-all hover:border-[#739072] focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            <span className="min-w-0 flex-1 truncate">
                                {selectedVisit
                                    ? `${selectedVisit.patient_name} - ${selectedVisit.visit_number}`
                                    : isLoadingVisits
                                      ? 'Memuat data...'
                                      : 'Pilih laporan kunjungan'}
                            </span>

                            <span className="shrink-0 rounded-full bg-[#F8FAF6] px-3 py-1 text-[11px] font-bold text-[#4F6F52]">
                                Cari
                            </span>
                        </button>
                    </div>

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
                        <span className={labelClassName}>Status Pembayaran</span>

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

                    <label className="block">
                        <span className={labelClassName}>Nominal</span>

                        <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            min="1"
                            required={!isUnpaid}
                            disabled={isSubmitting || isUnpaid}
                            placeholder={
                                isUnpaid
                                    ? 'Nonaktif untuk status unpaid'
                                    : 'Masukkan nominal'
                            }
                            className={inputClassName}
                        />

                        {isUnpaid && (
                            <p className="mt-1 text-[11px] text-[#8A8A8A]">
                                Nominal dikosongkan karena status pembayaran
                                belum dibayar.
                            </p>
                        )}
                    </label>

                    <label className="block">
                        <span className={labelClassName}>
                            Metode Pembayaran
                        </span>

                        <select
                            name="payment_method"
                            value={formData.payment_method}
                            onChange={handleChange}
                            required={!isUnpaid}
                            disabled={isSubmitting || isUnpaid}
                            className={selectClassName}
                        >
                            <option value="">
                                {isUnpaid
                                    ? 'Nonaktif untuk status unpaid'
                                    : 'Pilih metode pembayaran'}
                            </option>
                            <option value="Transfer">Transfer</option>
                            <option value="QRIS">QRIS</option>
                            <option value="Cash">Cash</option>
                        </select>

                        {isUnpaid && (
                            <p className="mt-1 text-[11px] text-[#8A8A8A]">
                                Metode pembayaran dikosongkan karena belum ada
                                pembayaran.
                            </p>
                        )}
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
                                    Pasien / Kunjungan
                                </p>

                                <p className="mt-1 text-[13px] font-bold text-[#2F3A2F]">
                                    {selectedVisit
                                        ? `${selectedVisit.patient_name} - ${selectedVisit.visit_number}`
                                        : 'Belum dipilih'}
                                </p>

                                {selectedVisit && (
                                    <p className="mt-1 text-[11px] text-[#6B6B6B]">
                                        {selectedVisit.record_number} -{' '}
                                        {selectedVisit.record_type} -{' '}
                                        {selectedVisit.visit_date}
                                    </p>
                                )}
                            </div>

                            <div className="text-left sm:text-right">
                                <p className="text-[11px] font-bold text-[#6B6B6B]">
                                    Total
                                </p>

                                <p className="mt-1 text-[16px] font-bold text-[#2F3A2F]">
                                    {isUnpaid
                                        ? 'Belum dibayar'
                                        : formatRupiah(formData.amount)}
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

            {isVisitModalOpen && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-6"
                    onClick={handleCloseVisitModal}
                >
                    <div
                        className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex flex-col gap-3 border-b border-[#E4E8E1] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="text-[18px] font-bold text-[#4F6F52]">
                                    Pilih Laporan Kunjungan
                                </h2>

                                <p className="mt-1 text-[12px] text-[#6B6B6B]">
                                    Cari berdasarkan nama pasien, NIK, nomor RM,
                                    nomor kunjungan, tipe rekam medis, tanggal,
                                    atau pembuat laporan.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleCloseVisitModal}
                                className="h-[34px] rounded-[30px] border border-[#D2D8CF] bg-white px-4 text-[12px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4]"
                            >
                                Tutup
                            </button>
                        </div>

                        <div className="border-b border-[#E4E8E1] px-5 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(event) =>
                                        setSearchKeyword(event.target.value)
                                    }
                                    placeholder="Cari laporan kunjungan..."
                                    className="h-[42px] flex-1 rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                                    autoFocus
                                />

                                {searchKeyword && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchKeyword('')}
                                        className="h-[42px] rounded-[30px] border border-[#D2D8CF] bg-white px-4 text-[12px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4]"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>

                            <p className="mt-2 text-[11px] font-semibold text-[#6B6B6B]">
                                Menampilkan {filteredVisitReports.length} dari{' '}
                                {visitReports.length} laporan kunjungan
                            </p>
                        </div>

                        <div className="max-h-[52dvh] overflow-y-auto px-5 py-4">
                            {isLoadingVisits ? (
                                <div className="rounded-[12px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[13px] font-semibold text-[#4F6F52]">
                                    Memuat data laporan kunjungan...
                                </div>
                            ) : filteredVisitReports.length === 0 ? (
                                <div className="rounded-[12px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center">
                                    <p className="text-[13px] font-bold text-[#2F3A2F]">
                                        Data tidak ditemukan
                                    </p>

                                    <p className="mt-1 text-[12px] text-[#6B6B6B]">
                                        Coba gunakan kata kunci lain.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {filteredVisitReports.map((visit) => {
                                        const isSelected =
                                            visit.visit_id ===
                                            formData.visit_id;

                                        return (
                                            <button
                                                type="button"
                                                key={visit.visit_id}
                                                onClick={() =>
                                                    handleSelectVisit(visit)
                                                }
                                                className={`rounded-[12px] border px-4 py-3 text-left transition-all hover:border-[#739072] hover:bg-[#F8FAF6] ${
                                                    isSelected
                                                        ? 'border-[#739072] bg-[#F8FAF6] ring-2 ring-[#739072]/10'
                                                        : 'border-[#E4E8E1] bg-white'
                                                }`}
                                            >
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[14px] font-bold text-[#2F3A2F]">
                                                            {visit.patient_name}
                                                        </p>

                                                        <p className="mt-1 text-[12px] text-[#6B6B6B]">
                                                            NIK: {visit.nik} -
                                                            RM:{' '}
                                                            {
                                                                visit.record_number
                                                            }
                                                        </p>

                                                        <p className="mt-1 text-[12px] text-[#6B6B6B]">
                                                            No. Kunjungan:{' '}
                                                            {visit.visit_number}{' '}
                                                            -{' '}
                                                            {visit.record_type}
                                                        </p>
                                                    </div>

                                                    <div className="shrink-0 text-left sm:text-right">
                                                        <p className="text-[12px] font-bold text-[#4F6F52]">
                                                            {visit.visit_date}
                                                        </p>

                                                        <p className="mt-1 text-[11px] text-[#6B6B6B]">
                                                            Dibuat oleh:{' '}
                                                            {visit.made_by}
                                                        </p>

                                                        {isSelected && (
                                                            <span className="mt-2 inline-flex rounded-full bg-[#739072] px-3 py-1 text-[10px] font-bold text-white">
                                                                Dipilih
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end border-t border-[#E4E8E1] px-5 py-4">
                            <button
                                type="button"
                                onClick={handleCloseVisitModal}
                                className="h-[38px] rounded-[30px] bg-[#739072] px-5 text-[12px] font-bold text-white hover:bg-[#5F785F]"
                            >
                                Selesai
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddInvoice;