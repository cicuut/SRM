'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { request } from "http";
import Cookies from 'js-cookie';
import Swal from "sweetalert2";
import PatientInformation from "@/components/patientInformation";
import FamilyInformation from "@/components/familyInformation";


const PregnancyRecord = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const [prePregnancyWeight, setPrePregnancyWeight] = useState("");
    const [prePregnancyMUAC, setPrePregnancyMUAC] = useState("");
    const [contraceptiveHistory, setContraceptiveHistory] = useState("");
    const [geneticDiseaseHistory, setGeneticDiseaseHistory] = useState("");
    const [previousPregnancy, setPreviousPregnancy] = useState("");
    const [lastMenstrualPeriod, setLastMenstrualPeriod] = useState("");
    const [estimatedDate, setEstimatedDate] = useState("");
    const [diagnosis, setDiagnosis] = useState("");
    const [date, setDate] = useState("");
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [ttScreening, setTtScreening] = useState("");
    const [labResult, setLabResult] = useState("");
    const [muac, setMuac] = useState("");
    const [rmNumber, setRmNumber] = useState("Generating RM Number");
    const searchParams = useSearchParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [obstetricHistory, setObstetricHistory] = useState<any[]>([]);
    const recordType = searchParams.get("type");
    const [patientData, setPatientData] = useState({});
    const [familyData, setFamilyData] = useState({});

    const handlePatientUpdate = (data: any) => setPatientData(data);
    const handleFamilyUpdate = (data: any) => setFamilyData(data);

    const fetchRmNumber = async () => {
        try {
            const token = Cookies.get('access_token');

            if (!token || !recordType) {
                setRmNumber("Unauthorized");
                return;
            }
            const response = await axios.get(
                `http://localhost:5000/api/medical-record/rm-number?type=${recordType}`,
                { headers: { Authorization: `Bearer ${token}` } }
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
    const handlePregnancyCountChange = (count: string) => {
        const num = parseInt(count) || 0;
        setPreviousPregnancy(count);

        // Bikin array baru sebanyak jumlah 'num'
        const newHistory = Array.from({ length: num }, (_, i) => ({
            pregnancy_no: i + 1,
            gestational_age: "",
            delivery_mode: "",
            pregnancy_complications: "",
            delivery_complications: "",
            birth_weight_height: "",
            postpartum_status: "",
            baby_complications: "",
            postpartum_complications: ""
        }));

        setObstetricHistory(newHistory);
        if (num > 0) setIsModalOpen(true); // Buka modal kalau input > 0
    };
    const updateHistoryItem = (index: number, field: string, value: string) => {
        const updated = [...obstetricHistory];
        updated[index][field] = value;
        setObstetricHistory(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const token = Cookies.get('access_token');
            if (!token) {
                alert("Unauthorized. Please log in.");
                return;
            }
            const payload = {
                ...patientData,
                ...familyData,
                record_number: rmNumber,
                record_type: recordType,
                pre_preg_weight_kg: prePregnancyWeight,
                pre_preg_muac_cm: prePregnancyMUAC,
                contraceptive_history: contraceptiveHistory,
                family_med_history: geneticDiseaseHistory,
                pregnancy_no: previousPregnancy,
                last_menstrual_period: lastMenstrualPeriod,
                expected_due_date: estimatedDate,
                diagnosis: diagnosis,
                registration_date: date,
                height_cm: height,
                weight_kg: weight,
                tt_screening: ttScreening,
                lab_results: labResult,
                muac_cm: muac,
                obstetric_list: obstetricHistory
            };
            console.log("ISI PAKET BUAT MAT:", payload);
            const response = await axios.post("http://localhost:5000/api/medical-record/add-pregnancy", payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.status === 201) {
                Swal.fire({
                    title: "Success",
                    text: "Data KB NADI berhasil disimpan!",
                    icon: "success",
                    timer: 2000,
                    confirmButtonColor: "#739072"
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
                confirmButtonColor: "#739072",
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
                    record_type={recordType || "Kehamilan"}
                    onDataChange={handlePatientUpdate}
                />
                <FamilyInformation
                    onDataChange={handleFamilyUpdate}
                />
                <div className="flex flex-col gap-0">
                    <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none !font-lexend">Riwayat Obstetri Sebelumnya</h2>
                    <hr className="mt-0"></hr>
                </div>
                <div className="flex flex-col mt-4 gap-y-4">
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Berat Sebelum Kehamilan
                            <input type="text" value={prePregnancyWeight} onChange={(e) => setPrePregnancyWeight(e.target.value)} name="prePregnancyWeight" id="prePregnancyWeight" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            MUAC Sebelum Kehamilan
                            <input type="text" value={prePregnancyMUAC} onChange={(e) => setPrePregnancyMUAC(e.target.value)} name="prePregnancyMUAC" id="prePregnancyMUAC" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1" >
                            Riwayat Kontrasepsi
                            <input type="text" value={contraceptiveHistory} onChange={(e) => setContraceptiveHistory(e.target.value)} name="contraceptiveHistory" id="contraceptiveHistory" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col flex-1" >
                            Penyakit Genetik dalam Keluarga
                            <textarea value={geneticDiseaseHistory} onChange={(e) => setGeneticDiseaseHistory(e.target.value)} name="geneticDiseaseHistory" id="geneticDiseaseHistory" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-start">
                        <div className="flex flex-col flex-1 " >
                            Berapa kali hamil sebelumnya?
                            <select
                                value={previousPregnancy}
                                onChange={(e) => handlePregnancyCountChange(e.target.value)}
                                className="rounded-md border border-gray-300 p-1 shadow-sm bg-white"
                            >
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                            </select>
                        </div>
                    </div>
                    {obstetricHistory.length > 0 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                            {obstetricHistory.map((item, index) => (
                                <div key={index}  >
                                    <h3 className="font-bold text-[#739072] mb-4">Kehamilan Ke-{index + 1}</h3>
                                    <div className="flex flex-col mt-4 gap-y-4">
                                        <div className="flex flex-row w-full gap-20 justify-between">
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Usia Kehamilan
                                                <input type="text" value={item.gestational_age} onChange={(e) => updateHistoryItem(index, 'gestational_age', e.target.value)} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                                            </div>
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Cara Persalinan
                                                <input type="text" value={item.delivery_mode} onChange={(e) => updateHistoryItem(index, 'delivery_mode', e.target.value)} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                                            </div>
                                        </div>
                                        <div className="flex flex-row w-full gap-20 justify-between">
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Komplikasi Kehamilan
                                                <textarea value={item.pregnancy_complications} onChange={(e) => updateHistoryItem(index, 'pregnancy_complications', e.target.value)} className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                                            </div>
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Komplikasi Persalinan
                                                <textarea value={item.delivery_complications} onChange={(e) => updateHistoryItem(index, 'delivery_complications', e.target.value)} className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                                            </div>
                                        </div>
                                        <div className="flex flex-row w-full gap-20 justify-between">
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Berat dan Panjang Badan Bayi
                                                <input type="text" value={item.birth_weight_height} onChange={(e) => updateHistoryItem(index, 'birth_weight_height', e.target.value)} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                                            </div>
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Waktu Nifas
                                                <input type="text" value={item.postpartum_status} onChange={(e) => updateHistoryItem(index, 'postpartum_status', e.target.value)} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                                            </div>
                                        </div>
                                          <div className="flex flex-row w-full gap-20 justify-between">
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Komplikasi Bayi
                                                <textarea value={item.baby_complications} onChange={(e) => updateHistoryItem(index, 'baby_complications', e.target.value)} className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                                            </div>
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Komplikasi Nifas
                                                <textarea value={item.postpartum_complications} onChange={(e) => updateHistoryItem(index, 'postpartum_complications', e.target.value)} className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex flex-col gap-0">
                        <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none !font-lexend">Kehamilan Saat Ini</h2>
                        <hr className="mt-0"></hr>
                    </div>
                    <div className="flex flex-col mt-4 gap-y-4">
                        <div className="flex flex-row w-full gap-20 justify-between">
                            <div className="flex flex-col flex-1 gap-y-1 ">
                                Hari Pertama Haid Terakhir
                                <input type="date" value={lastMenstrualPeriod} onChange={(e) => setLastMenstrualPeriod(e.target.value)} name="lastMenstrualPeriod" id="lastMenstrualPeriod" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                            <div className="flex flex-col  flex-1">
                                Tanggal Estimasi Persalinan
                                <input type="date" value={estimatedDate} onChange={(e) => setEstimatedDate(e.target.value)} name="estimatedDateOfDelivery" id="estimatedDateOfDelivery" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                        </div>
                        <div className="flex flex-row w-full gap-20 justify-between">
                            <div className="flex flex-col flex-1" >
                                Diagnosis
                                <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} name="diagnosis" id="diagnosis" className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-0">
                        <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none !font-lexend">Pemeriksaan Umum</h2>
                        <hr className="mt-0"></hr>
                    </div>
                    <div className="flex flex-col mt-4 gap-y-4">
                        <div className="flex flex-row w-full gap-20 justify-between">
                            <div className="flex flex-col flex-1 gap-y-1 ">
                                Hari
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} name="registration_date" id="date" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                            <div className="flex flex-col  flex-1">
                                Tinggi Badan
                                <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} name="height" id="height" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                        </div>
                        <div className="flex flex-row w-full gap-20 justify-between">
                            <div className="flex flex-col flex-1 gap-y-1 ">
                                Berat Badan
                                <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} name="weight" id="weight" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                            <div className="flex flex-col  flex-1">
                                TT Screening
                                <input type="text" value={ttScreening} onChange={(e) => setTtScreening(e.target.value)} name="ttScreening" id="ttScreening" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                        </div>
                        <div className="flex flex-row w-full gap-20 justify-between">
                            <div className="flex flex-col flex-1 gap-y-1 ">
                                Hasil Lab
                                <textarea value={labResult} onChange={(e) => setLabResult(e.target.value)} name="laboratoryResults" id="laboratoryResults" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                            <div className="flex flex-col  flex-1">
                                MUAC
                                <input type="text" value={muac} onChange={(e) => setMuac(e.target.value)} name="muac" id="muac" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-center gap-4 mt-10">
                        <button
                            onClick={handleSubmit}
                            type="submit"
                            className="px-8 py-2 bg-[#739072] text-white rounded-full hover:bg-[#4F6F52] shadow-lg transition font-bold cursor-pointer"
                        >
                            Simpan Rekam Medis
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PregnancyRecord;
