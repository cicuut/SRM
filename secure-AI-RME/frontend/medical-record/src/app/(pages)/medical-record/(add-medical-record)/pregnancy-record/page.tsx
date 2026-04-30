'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { request } from "http";
import Cookies from 'js-cookie';
import Swal from "sweetalert2";
import PatientInformation from "@/components/add-records/patientInformation";
import FamilyInformation from "@/components/add-records/familyInformation";


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


        const newHistory = Array.from({ length: num }, (_, i) => ({
            pregnancy_no: i + 1,
            gestational_age: "",
            delivery_mode: "",
            pregnancy_complications: "",
            delivery_complications: "",
            baby_weight: "",
            baby_hight:"",
            postpartum_status: "",
            baby_complications: "",
            postpartum_complications: ""
        }));

        setObstetricHistory(newHistory);
        if (num > 0) setIsModalOpen(true);
    };
    const updateHistoryItem = (index: number, field: string, value: string) => {
        const updated = [...obstetricHistory];
        updated[index][field] = value;
        setObstetricHistory(updated);
    };

    useEffect(() => {
        if (lastMenstrualPeriod) {
            const date = new Date(lastMenstrualPeriod);
            let d = date.getDate();
            let m = date.getMonth(); 
            let y = date.getFullYear();

       
            if (m <= 2) {
                m = m + 9;
            } else {
                m = m - 3;
                y = y + 1;
            }

            d = d + 7;

            const hplDate = new Date(y, m, d);

            const finalYear = hplDate.getFullYear();
            const finalMonth = String(hplDate.getMonth() + 1).padStart(2, '0');
            const finalDay = String(hplDate.getDate()).padStart(2, '0');

            setEstimatedDate(`${finalDay}/${finalMonth}/${finalYear}`);
        }
    }, [lastMenstrualPeriod]);

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
                            <input type="number" value={prePregnancyWeight} placeholder="Tanpa satuan" onChange={(e) => setPrePregnancyWeight(e.target.value)} name="prePregnancyWeight" id="prePregnancyWeight" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            Lingkar Lengan Atas Sebelum Kehamilan
                            <input type="number" value={prePregnancyMUAC} placeholder="Tanpa satuan" onChange={(e) => setPrePregnancyMUAC(e.target.value)} name="prePregnancyMUAC" id="prePregnancyMUAC" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1" >
                            Riwayat Kontrasepsi
                            <select value={contraceptiveHistory} onChange={(e) => setContraceptiveHistory(e.target.value)} className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                                <option value="" disabled>Pilih</option>
                                <option value="PIL">PIL</option>
                                <option value="Suntik 1 Bulan">Suntik 1 Bulan</option>
                                <option value="Suntik 3 Bulan">Suntik 3 Bulan</option>
                                <option value="IUD">IUD</option>
                                <option value="Inplan">Inplan</option>
                            </select>
                        </div>
                        <div className="flex flex-col flex-1" >
                            Penyakit Genetik dalam Keluarga
                            <textarea value={geneticDiseaseHistory} onChange={(e) => setGeneticDiseaseHistory(e.target.value)} name="geneticDiseaseHistory" id="geneticDiseaseHistory" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
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
                                <option value="6">6</option>
                                <option value="7">7</option>
                                <option value="8">8</option>
                                <option value="9">9</option>
                                <option value="10">10</option>
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
                                                <input type="text" value={item.gestational_age} onChange={(e) => updateHistoryItem(index, 'gestational_age', e.target.value)} className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                                            </div>
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Cara Persalinan
                                                <select value={item.delivery_mode} onChange={(e) => updateHistoryItem(index, 'delivery_mode', e.target.value)} className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                                                    <option value="" disabled>Pilih</option>
                                                    <option value="spontan">Spontan</option>
                                                    <option value="normal">Normal</option>
                                                    <option value="sc">SC</option>
                                                </select>
                                                <input type="text" />
                                            </div>
                                        </div>
                                        <div className="flex flex-row w-full gap-20 justify-between">
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Komplikasi Kehamilan
                                                <textarea value={item.pregnancy_complications} onChange={(e) => updateHistoryItem(index, 'pregnancy_complications', e.target.value)} className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2" />
                                            </div>
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Komplikasi Persalinan
                                                <textarea value={item.delivery_complications} onChange={(e) => updateHistoryItem(index, 'delivery_complications', e.target.value)} className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2" />
                                            </div>
                                        </div>
                                        <div className="flex flex-row w-full gap-20 justify-between">
                                            <div className="flex flex-row flex-1 gap-3 text-sm">
                                                <div className="flex flex-col flex-1">    Berat Badan Bayi
                                                <input type="number" value={item.baby_weight} onChange={(e) => updateHistoryItem(index, 'birth_weight', e.target.value)} className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" /></div>
                                                     <div className="flex flex-col flex-1">    Panjang Badan Bayi
                                                <input type="number" value={item.baby_hight} onChange={(e) => updateHistoryItem(index, 'birth_hight', e.target.value)} className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" /></div>
                                            
                                            </div>
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Masa Nifas
                                                <select value={item.postpartum_status} onChange={(e) => updateHistoryItem(index, 'postpartum_status', e.target.value)} className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                                                    <option value="" disabled>Pilih</option>
                                                    <option value="normal">Normal</option>
                                                    <option value="komplikasi">Komplikasi</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex flex-row w-full gap-20 justify-between">
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Komplikasi Bayi
                                                <textarea value={item.baby_complications} onChange={(e) => updateHistoryItem(index, 'baby_complications', e.target.value)} className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2" />
                                            </div>
                                            <div className="flex flex-col flex-1 gap-1 text-sm">
                                                Komplikasi Nifas
                                                <textarea value={item.postpartum_complications} onChange={(e) => updateHistoryItem(index, 'postpartum_complications', e.target.value)} className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2" />
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
                                <input type="date" value={lastMenstrualPeriod} onChange={(e) => setLastMenstrualPeriod(e.target.value)} name="lastMenstrualPeriod" id="lastMenstrualPeriod" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                            <div className="flex flex-col  flex-1">
                                Tanggal Estimasi Persalinan
                                <input value={estimatedDate} readOnly placeholder="*automated by system" onChange={(e) => setEstimatedDate(e.target.value)} name="estimatedDateOfDelivery" id="estimatedDateOfDelivery" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                        </div>
                        <div className="flex flex-row w-full gap-20 justify-between">
                            <div className="flex flex-col flex-1" >
                                Diagnosis
                                <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} name="diagnosis" id="diagnosis" className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2" />
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
                            Tanggal dan Hari Registrasi
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} name="registration_date" id="date" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                            <div className="flex flex-col  flex-1">
                                Tinggi Badan (cm)
                                <input type="number" value={height} placeholder="Tanpa satuan" onChange={(e) => setHeight(e.target.value)} name="height" id="height" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                        </div>
                        <div className="flex flex-row w-full gap-20 justify-between">
                            <div className="flex flex-col flex-1 gap-y-1 ">
                                Berat Badan (kg)
                                <input type="number" value={weight} placeholder="Tanpa satuan" onChange={(e) => setWeight(e.target.value)} name="weight" id="weight" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                            <div className="flex flex-col  flex-1">
                                TT Screening
                                <select value={ttScreening} onChange={(e) => setTtScreening(e.target.value)} name="ttScreening" id="ttScreening" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" >
                                    <option value="" disabled> Pilih</option>
                                    <option value="TT 0"> TT 0</option>
                                    <option value="TT 1"> TT 1</option>
                                    <option value="TT 2"> TT 2</option>
                                    <option value="TT 3"> TT 3</option>
                                    <option value="TT 4"> TT 4</option>
                                    <option value="TT 5"> TT 5</option>
                                </select>
                              
                            </div>
                        </div>
                        <div className="flex flex-row w-full gap-20 justify-between">
                            <div className="flex flex-col flex-1 gap-y-1 ">
                                Hasil Lab
                                <textarea value={labResult} onChange={(e) => setLabResult(e.target.value)} name="laboratoryResults" id="laboratoryResults" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                            </div>
                            <div className="flex flex-col  flex-1">
                             Lingkar Lengan Atas (cm)
                                <input type="number" value={muac} placeholder="Tanpa satuan" onChange={(e) => setMuac(e.target.value)} name="muac" id="muac" className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
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
