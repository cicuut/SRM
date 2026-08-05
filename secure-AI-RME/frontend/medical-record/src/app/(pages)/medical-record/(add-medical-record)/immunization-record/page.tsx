'use client';
import React from "react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PatientInformation from "@/components/add-records/patientInformation";
import FamilyInformation from "@/components/add-records/familyInformation";
import Swal from "sweetalert2";
import api from "@/utils/app";

const ImmunizationRecord = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [rmNumber, setRmNumber] = useState("Generating RM Number");
    const searchParams = useSearchParams();
    const router = useRouter();
    const [vaccineType, setVaccineType] = useState("");
    const [doseNumber, setDoseNumber] = useState("");
    const recordType = searchParams.get("type");
    const [patientData, setPatientData] = useState({});
    const [familyData, setFamilyData] = useState({});
    const [familyAutoFillData, setFamilyAutoFillData] = useState(null);
    const handlePatientUpdate = (data: any) => setPatientData(data);
    const handleFamilyUpdate = (data: any) => setFamilyData(data);

    const fetchRmNumber = async () => {
        try {
            const response = await api.get(
                `/medical-record/rm-number?type=${recordType}`,
            );
            setRmNumber(response.data.next_rm_number);
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

    useEffect(() => {
        fetchRmNumber();
    }, [recordType]);

    const handleSubmit = async () => {
        try {
            const payload = {
                ...patientData,
                ...familyData,
                record_number: rmNumber,
                record_type: recordType,
            };
            const response = await api.post("/medical-record/add-immunization", payload);
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
        } catch (err) {
            console.error(err);
            alert("Gagal konek ke server!");
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
                record_type={recordType || "Kehamilan"}
                onDataChange={handlePatientUpdate}
                onFamilyAutoFill={(data) => setFamilyAutoFillData(data)}
            />
            <FamilyInformation
                onDataChange={handleFamilyUpdate} autoFillData={familyAutoFillData}
            />

            <div className="flex justify-center gap-4">
                <button
                    onClick={handleSubmit}
                    type="submit"
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
export default function ImmunizationRecordPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-[#F8FAF6]">
                <p className="text-[#739072] animate-pulse font-medium text-sm">
                    Memuat Form Imunisasi...
                </p>
            </div>
        }>
            <ImmunizationRecord />
        </Suspense>
    );
}

