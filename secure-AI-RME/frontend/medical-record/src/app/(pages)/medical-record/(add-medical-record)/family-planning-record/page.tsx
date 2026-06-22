'use client';
import React from "react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import PatientInformation from "@/components/add-records/patientInformation";
import FamilyInformation from "@/components/add-records/familyInformation";
import api from "@/utils/app";

const FamilyPlanningRecord = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const [numberOfChildren, setNumberOfChildren] = useState("");
    const [youngestChild, setYoungestChild] = useState("");
    const [geneticDiseaseHistory, setGeneticDiseaseHistory] = useState("");

    const [rmNumber, setRmNumber] = useState("Generating RM Number");
    const searchParams = useSearchParams();

    const recordType = searchParams.get("type");
    const [patientData, setPatientData] = useState({});
    const [familyData, setFamilyData] = useState({});

    const handlePatientUpdate = (data: any) => setPatientData(data);
    const handleFamilyUpdate = (data: any) => setFamilyData(data);
    const fetchRmNumber = async () => {
        try {
            const response = await api.get(
                `/medical-record/rm-number?type=${recordType}`
            );
            setRmNumber(response.data.next_rm_number);
        } catch (error) {
            console.error("Error fetching RM number:", error);
            setRmNumber("Failed to generate RM Number");
        }
    };
    useEffect(() => {
        fetchRmNumber();
    }, [recordType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const payload = {
                ...patientData,
                ...familyData,
                record_number: rmNumber,
                record_type: recordType,
                number_of_children: numberOfChildren,
                youngest_child_age: youngestChild,
                family_med_history: geneticDiseaseHistory
            };
            const response = await api.post("/medical-record/add-family-planning", payload);
            if (response.status === 201) {
                Swal.fire({
                    title: "Success",
                    text: "Rekam medis berhasil disimpan!",
                    icon: "success",
                    showConfirmButton: false,
                    timer: 2000
                });
                fetchRmNumber();
            } router.push('/medical-record');
        } catch (err: any) {
            console.error(err);
            setLoading(false);
            const errorMessage = err.response?.data?.msg || "Something went wrong";
            Swal.fire({
                title: "Gagal Menyimpan!",
                text: errorMessage,
                icon: "error",
                showConfirmButton: false,
                timer: 2000
            });
            setError(errorMessage);
        }
    };
    return (
        <div className="relative flex w-full min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#D2D8CF] bg-white px-5 py-4 shadow-sm">
                <div>
                    <h1 className="text-[20px] font-bold text-[#4F6F52]">
                        Tambah Rekam Medis
                    </h1>

                    <p className="mt-1 text-[12px] text-[#6B6B6B]">
                        Isi data rekam medis baru untuk laporan keuangan klinik.
                    </p>
                </div>

                <div className="rounded-[10px] bg-[#F8FAF6] px-4 py-3 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#739072]">
                        Nomor Rekam Medis
                    </p>

                    <p className="mt-1 text-[14px] font-bold text-[#2F3A2F]">
                        {rmNumber || "INV-----"}
                    </p>
                </div>
            </div>
            <PatientInformation
                record_type={recordType || "Keluarga Berencana"}
                onDataChange={handlePatientUpdate}
            />
            <FamilyInformation
                onDataChange={handleFamilyUpdate}
            />
            <div className="flex flex-col gap-0">
                <h2 className="text-md text-[#4F6F52] underline leading-none font-lexend!">Riwayat Kehamilan</h2>
                <hr className="mt-0"></hr>
            </div>
            <div className="grid grid-cols-1 gap-4 px-5  md:grid-cols-2">
                <label className="block">
                    <p className="text-md font-medium text-gray-700 md:text-sm">Jumlah Anak</p>
                    <input type="number" name="numberOfChildren" value={numberOfChildren} onChange={(e) => setNumberOfChildren(e.target.value)} id="numberOfChildren" className="w-full h-8 rounded-md p-2 bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </label>
                <label className="block">
                   <p className="text-md font-medium text-gray-700 md:text-sm">Anak terkecil</p>
                    <input type="text" name="youngestChild" value={youngestChild} id="youngestChild" onChange={(e) => setYoungestChild(e.target.value)} className="w-full h-8 rounded-md bg-white p-2 drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </label>
                </div>
                <div className="grid grid-cols-1 px-5 pb-5"> 
                <label className="block">
                    <p className="text-md font-medium text-gray-700 md:text-sm">Penyakit Genetik Dalam Keluarga</p>
                    <textarea name="geneticDiseaseHistory" value={geneticDiseaseHistory} onChange={(e) => setGeneticDiseaseHistory(e.target.value)} id="geneticDiseaseHistory" className="w-full h-8 p-2 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </label>
                </div>
                
                <div className="flex justify-center gap-4 ">
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-8 py-2 bg-[#739072] text-white rounded-full hover:bg-[#4F6F52] shadow-lg transition font-bold cursor-pointer"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="spinner"></div>
                                <span>Memproses...</span>
                            </div>
                        ) : (
                            "Simpan"
                        )}
                    </button>
                </div>
            </div>
    )

}
export default function FamilyPlanningRecordPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-[#F8FAF6]">
                <p className="text-[#739072] animate-pulse font-medium text-sm">
                    Memuat Form Keluarga Berencana...
                </p>
            </div>
        }>
            <FamilyPlanningRecord />
        </Suspense>
    );
}

