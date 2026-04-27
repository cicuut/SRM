'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '@/components/sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
        trans_type: 'Income',
        amount: '',
        payment_method: 'Transfer',
        status: 'Paid',
        description: '',
    });

    const [isLoadingRecords, setIsLoadingRecords] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const selectedRecord = useMemo(() => {
        return medicalRecords.find(
            (record) => record.rm_id === formData.visit_id,
        );
    }, [medicalRecords, formData.visit_id]);

    const fetchTransactionNumber = async (date: string) => {
        try {
            const token = Cookies.get('access_token');

            const response = await fetch(
                `${API_BASE_URL}/financial-report/transaction-number?date=${date}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.msg || 'Gagal membuat nomor transaksi',
                );
            }

            setTransactionNumber(data.transaction_number);
        } catch (error) {
            const year = date.split('-')[0];
            setTransactionNumber(`INV-${year}----`);
        }
    };

    const fetchMedicalRecords = async () => {
        try {
            setIsLoadingRecords(true);
            setErrorMessage('');

            const token = Cookies.get('access_token');

            const response = await fetch(
                `${API_BASE_URL}/medical-record/get-all-records`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.msg || 'Gagal mengambil data medical record',
                );
            }

            setMedicalRecords(data);
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
        fetchMedicalRecords();
    }, []);

    useEffect(() => {
        fetchTransactionNumber(formData.payment_date);
    }, [formData.payment_date]);

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

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setIsSubmitting(true);
            setErrorMessage('');

            const token = Cookies.get('access_token');

            const response = await fetch(`${API_BASE_URL}/financial-report/add`, {
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

            const data = await response.json();

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

    return (
        <div className="min-h-screen w-full flex bg-[#FDFEF9] overflow-x-auto">
            <Sidebar />

            <main className="flex-1 flex flex-col min-h-screen min-w-0 bg-[#FDFEF9] pt-[26px] pb-[40px] pl-[28px] pr-[28px]">
                <div className="w-full">
                    
                    <form
                        onSubmit={handleSubmit}
                        className="mt-[54px] w-full max-w-[980px]"
                    >
                        <h1 className="text-[26px] leading-none font-bold text-[#5F785F]">
                            {transactionNumber || 'INV----- ---'}
                        </h1>

                        {errorMessage && (
                            <p className="mt-5 text-[12px] font-medium text-red-600">
                                {errorMessage}
                            </p>
                        )}

                        <div className="mt-[26px] grid grid-cols-1 md:grid-cols-3 gap-x-[48px] gap-y-[20px]">
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
                                    <option value="Income">Income</option>
                                    <option value="Expense">Expense</option>
                                    <option value="Other">Other</option>
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
                                    <option value="Paid">Paid</option>
                                    <option value="Unpaid">Unpaid</option>
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

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="mt-[42px] min-w-[120px] rounded-[50px] bg-[#86A789] px-6 py-2 text-[12px] font-semibold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? 'Saving...' : 'Add Record'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default AddInvoice;