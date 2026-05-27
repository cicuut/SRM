'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { request } from "http";
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';
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
        <div className="min-h-screen flex bg-[#FDFEF9]">
            <div className="flex-1 flex flex-col w-full ml-10 mt-7">
                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        value={rmNumber}
                        readOnly
                        className="bg-transparent font-mono font-bold cursor-not-allowed focus:outline-none text-3xl text-[#4F6F52] w-full"
                    />
                    <p className="text-[10px] text-gray-400">*Otomatis oleh sistem</p>
                </div>
                <PatientInformation
                    record_type={recordType || "Keluarga Berencana"}
                    onDataChange={handlePatientUpdate}
                />
                <FamilyInformation
                    onDataChange={handleFamilyUpdate}
                />
                <div className="flex flex-col gap-0">
                    <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none font-lexend!">Riwayat Kehamilan</h2>
                    <hr className="mt-0"></hr>
                </div>
                <div className="flex flex-col mt-4 gap-y-4">
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Jumlah Anak
                            <input type="number" name="numberOfChildren" value={numberOfChildren} onChange={(e) => setNumberOfChildren(e.target.value)} id="numberOfChildren" className="w-full h-8 rounded-md p-2 bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            Anak terkecil
                            <input type="text" name="youngestChild" value={youngestChild} id="youngestChild" onChange={(e) => setYoungestChild(e.target.value)} className="w-full h-8 rounded-md bg-white p-2 drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1" >
                           Penyakit Genetik Dalam Keluarga
                            <textarea name="geneticDiseaseHistory" value={geneticDiseaseHistory} onChange={(e) => setGeneticDiseaseHistory(e.target.value)} id="geneticDiseaseHistory" className="w-full h-8 p-2 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex justify-center gap-4 mt-10">
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
            </div>
        </div>

    )

}
export default FamilyPlanningRecord;
