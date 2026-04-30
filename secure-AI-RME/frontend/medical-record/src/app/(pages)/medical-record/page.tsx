'use client';
import { useState, useEffect } from "react";
import { useRouter } from 'nextjs-toploader/app'
import Swal from "sweetalert2";
import Cookies from 'js-cookie';
import { Plus, Search, Funnel, X, ChevronDown   } from 'lucide-react';

interface MedicalRecordList {
    rm_id: string;
    record_number: string;
    record_type: string;
    patient_name: string;
    nik: string;
    birth_date: string;
    status: string;
    created_at: string;
    updated_at: string;
    patient_number?: string;
    address?: string;
}

const MedicalRecord = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [medicalRecordList, setMedicalRecordList] = useState<MedicalRecordList[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedType, setSelectedType] = useState("Select a type");
    const router = useRouter();

    useEffect(() => {
        const fetchMedicalRecord = async () => {
            try {
                const token = Cookies.get('access_token');
                const response = await fetch('http://localhost:5000/api/medical-record/get-all-records', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) throw new Error('Gagal mengambil data pasien');

                const data = await response.json();
                setMedicalRecordList(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMedicalRecord();
    }, []);

    if (loading) {
        return <div className="max-w-5xl mx-auto">Loading...</div>;
    }   
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

    const handleSubmitRecordType = (e: React.FormEvent) => {
        e.preventDefault();

        setIsModalOpen(false);
        setIsDropdownOpen(false);
        setSelectedType("Select a type");
        setLoading(true);
        switch (selectedType) {
            case "Rekam Medis Kehamilan":
                router.push('/medical-record/pregnancy-record?type=Kehamilan');
                break;
            case "Rekam Medis Keluarga Berencana":
                router.push('/medical-record/family-planning-record?type=Keluarga Berencana');
                break;
            case "Rekam Medis Poli Umum":
                router.push('/medical-record/general-record?type=Umum');
                break;
            case "Rekam Medis Bayi dan Imunisasi":
                router.push('/medical-record/immunization-record?type=Imunisasi');
                break;
            case "Rekam Medis Persalinan":
                router.push('/medical-record/delivery-record?type=Persalinan');
                break;
            default:
                Swal.fire({
                    title: "Proses Gagal",
                    text: "Pilih tipe rekam medis terlebih dahulu",
                    icon: "error",
                    confirmButtonColor: "#739072",
                    timer: 2000
                });
        }
    };

    const handleViewRecordDetail = (rmId: string) => {
        router.push(`/medical-record/${rmId}`);
    }


    return (
        <div>
            <div className="flex-1 flex flex-col  w-full">
                <div className="w-full flex items-center py-6 gap-70  justify-between">
                    <div className="relative flex-1  outline-1 outline-gray-300 rounded-lg px-4 py-2 shadow-sm transition-all focus-within:border-[#739072]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 size-5" />
                        <form>
                            <input type="text" placeholder="Search for a record" className="w-full focus:outline-none pl-8 text-gray-700 placeholder-gray-400" />
                        </form>
                    </div>
                    <div className=" flex flex-row items-center gap-5 shrink-0">
                        <div className="flex flex-row items-center gap-x-[4]  outline-1 outline-black-200 rounded-[50px] px-9 py-2 bg-white shadow-sm transition-all focus-within:border-[#739072]">
                            <button>RM Type</button>
                        <Funnel className="size-4" />
                        </div>

                        <div onClick={() => setIsModalOpen(true)} className="cursor-pointer flex flex-row items-center gap-x-[4]  rounded-[50px] px-5 py-2 bg-[#86A789] shadow-sm transition-all focus-within:border-[#739072]">
                        <Plus className="size-4"/>
                            <span className="font-bold">Tambah Rekam Medis</span>
                        </div>

                    </div>
                </div>
                <div className="mt-5">
                    <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                        <thead className="bg-[#D2E3C8] text-gray-700 font-semibold drop-shadow-lg ">
                            <tr>
                                <th className="px-6 py-4 border-r border-gray-200 w-40">RM ID</th>
                                <th className="px-6 py-4 border-r border-gray-200 w-60">Record Type</th>
                                <th className="px-6 py-4 border-r border-gray-200 w-60">Patient Name</th>
                                <th className="px-6 py-4 border-r border-gray-200">NIK</th>
                                <th className="px-6 py-4 border-r border-gray-200 w-40">Birth Date</th>
                                <th className="px-6 py-4 border-r border-gray-200 w-40">Case Status</th>
                                <th className="px-6 py-4 border-r border-gray-200 w-40">Created At</th>
                                <th className="px-6 py-4 w-40">Last Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {medicalRecordList.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50 transition-colors text-gray-600 cursor-pointer" onClick={() => handleViewRecordDetail(item.rm_id)}>
                                    <td className="px-4 py-4 ">{item.record_number}</td>
                                    <td className="px-4 py-4">{item.record_type}</td>
                                    <td className="px-4 py-4">{item.patient_name}</td>
                                    <td className="px-4 py-4 text-center">{item.nik}</td>
                                    <td className="px-4 py-4 text-center">{item.birth_date}</td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs ${item.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{item.created_at}</td>
                                    <td className="px-6 py-4">{item.updated_at}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">

                    <div className="flex flex-col gap-y-6 bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-y-auto animate-in fade-in zoom-in duration-200 pb-8">


                        <div className="bg-[#739072] p-4 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">Pilih Tipe Rekam Medis</h2>
                            <button onClick={() => {
                                setIsModalOpen(false);
                                setIsDropdownOpen(false);
                                setSelectedType("Select a type");
                            }} className="cursor-pointer hover:scale-110 transition">
                                <X className="w-5" />
                            </button>
                        </div>


                        <form onSubmit={handleSubmitRecordType} className="relative w-full px-8 flex flex-col gap-6">

                            <div className="relative w-full">
                                <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex flex-row items-center justify-between w-full border border-gray-300 rounded-full px-6 py-3 bg-white shadow-sm hover:bg-gray-50 transition-all text-gray-700 font-medium"
                                >
                                    <span>{selectedType}</span>
                                    <ChevronDown className={`text-gray-400 w-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isDropdownOpen && (
                                    <ul className="overflow-y-auto left-0 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-40 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {['Kehamilan', 'Keluarga Berencana', 'Poli Umum', 'Bayi dan Imunisasi', 'Persalinan'].map((item) => (
                                            <li
                                                key={item}
                                                onClick={() => {
                                                    setSelectedType("Rekam Medis " + item);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className="px-4 py-3 hover:bg-[#D2E3C8] hover:text-[#4F6F52] cursor-pointer transition-colors text-sm border-b last:border-0 border-gray-50"
                                            >
                                                Rekam Medis {item}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="flex justify-center gap-4 mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        setIsDropdownOpen(false);
                                        setSelectedType("Select a type");
                                    }}
                                    className="px-8 py-2 border border-gray-300 rounded-full hover:bg-gray-100 transition font-medium text-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2 bg-[#739072] text-white rounded-full hover:bg-[#4F6F52] shadow-lg transition font-bold"
                                >
                                    Pilih Rekam Medis
                                </button>
                            </div>
                        </form>

                    </div>
                </div>
            )
            }
        </div >
    )


}

export default MedicalRecord;
