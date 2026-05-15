'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

const inputClassName =
    'mt-[8px] h-[34px] w-full rounded-[4px] border border-transparent bg-white px-3 text-[13px] text-black shadow-md outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

const selectClassName =
    'mt-[8px] h-[34px] w-full rounded-[4px] border border-transparent bg-white px-3 text-[13px] text-black shadow-md outline-none transition-all focus:border-[#739072] focus:ring-1 focus:ring-[#739072]';

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
                throw new Error(data?.msg || 'Gagal mengecek akses user');
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
                `${API_BASE_URL}/financial/transaction-number?date=${date}`,
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
            const year = date.split('-')[0];
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
                    data?.msg || 'Gagal mengambil data medical record',
                );
            }

            setMedicalRecords(Array.isArray(data) ? data : []);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Terjadi kesalahan saat mengambil data medical record';

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

        if (!formData.trans_type) {
            return 'Transaction type wajib dipilih';
        }

        if (!['pemasukan', 'pengeluaran'].includes(formData.trans_type)) {
            return 'Transaction type tidak valid';
        }

        if (!formData.amount || Number(formData.amount) <= 0) {
            return 'Total amount harus lebih dari 0';
        }

        if (!formData.payment_method) {
            return 'Payment method wajib dipilih';
        }

        if (!['Transfer', 'QRIS', 'Cash'].includes(formData.payment_method)) {
            return 'Payment method tidak valid';
        }

        if (!formData.status) {
            return 'Status wajib dipilih';
        }

        if (!['paid', 'unpaid'].includes(formData.status)) {
            return 'Status tidak valid';
        }

        return '';
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
                    description: formData.description,
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
            <div className="flex min-h-screen w-full overflow-x-auto bg-[#FDFEF9]">
                <Sidebar />

                <main className="flex min-h-screen min-w-0 flex-1 items-center justify-center bg-[#FDFEF9] pb-[40px] pl-[28px] pr-[28px] pt-[26px]">
                    <p className="text-[14px] font-bold text-[#5F785F]">
                        Checking financial access...
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
                    <form
                        onSubmit={handleSubmit}
                        className="mt-[54px] w-full max-w-[980px]"
                    >
                        <div>
                            <h1 className="text-[26px] font-bold leading-none text-[#5F785F]">
                                {transactionNumber || 'INV----- ---'}
                            </h1>

                            {errorMessage && (
                                <p className="mt-5 text-[12px] font-medium text-red-600">
                                    {errorMessage}
                                </p>
                            )}
                        </div>

                        <div className="mt-[26px] grid grid-cols-1 gap-x-[48px] gap-y-[20px] md:grid-cols-3">
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
                                    placeholder="150000"
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
                        </div>

                        {selectedRecord && (
                            <div className="mt-[24px] rounded-[12px] border border-[#D2D8CF] bg-[#EEF3E9] px-5 py-4 text-[12px] text-[#4B4B4B]">
                                <p>
                                    <span className="font-bold">Selected:</span>{' '}
                                    {selectedRecord.patient_name} -{' '}
                                    {selectedRecord.record_number}
                                </p>

                                <p className="mt-1">
                                    <span className="font-bold">Type:</span>{' '}
                                    {selectedRecord.record_type}
                                </p>
                            </div>
                        )}

                        <div className="mt-[36px]">
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

                        <div className="mt-[42px] flex flex-wrap items-center gap-[12px]">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="min-w-[120px] rounded-[50px] bg-[#86A789] px-6 py-2 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? 'Saving...' : 'Add Record'}
                            </button>

                            <button
                                type="button"
                                onClick={() => router.push('/financial-report')}
                                disabled={isSubmitting}
                                className="min-w-[100px] rounded-[50px] border border-[#BFC7BB] bg-white px-6 py-2 text-[12px] font-semibold text-[#4B4B4B] shadow-sm transition-all hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default AddInvoice;