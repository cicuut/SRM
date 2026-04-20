'use client';
import React from "react";
import { useState } from "react";
import Cookies from 'js-cookie';
import axios from "axios";
import { useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";

interface AddVisitPregnancyProps {
    record_id?: string;
    record_type?: string;
    patient_name?: string;
    record_number?: string;
    visit_date?: string;
    visit_time?: string;
}

const AddVisitPregnancy = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const id = params.id;
    const router = useRouter();
    const [visitNumber, setVisitNumber] = useState("Generating Visit Number");
    const [weight, setWeight] = useState("");
    const [height, setHeight] = useState("");
    const [heartRate, setHeartRate] = useState("");
    const [bloodPressure, setBloodPressure] = useState("");
    const [respiratoryRate, setRespiratoryRate] = useState("");
    const [temperature, setTemperature] = useState("");
    const [subjective, setSubjective] = useState("");
    const [objective, setObjective] = useState("");
    const [assessment, setAssessment] = useState("");
    const [plan, setPlan] = useState("");
    const uuid = params.id;
    const [data, setData] = useState<AddVisitPregnancyProps | null>(null);

    const fetchVisitNumber = async () => {
        try {
            const token = Cookies.get('access_token');

            if (!token) {
                setVisitNumber("Unauthorized");
                return;
            }
            const response = await axios.get(
                `http://localhost:5000/api/visit-report/visit-number`,
                { headers: { Authorization: `Bearer ${token}` }, params: { record_id: id } }
            );

            setVisitNumber(response.data.visit_number);
        } catch (error) {
            console.error("Error fetching Visit number:", error);
            setVisitNumber("Failed to generate Visit Number");
        }
    };

    useEffect(() => {
        if (id) fetchVisitNumber();
    }, [id]);

    useEffect(() => {
        const fetchPatientData = async () => {
            if (!uuid) return;
            try {
                const token = Cookies.get('access_token');
                const response = await fetch(`http://localhost:5000/api/visit-report/get-visit-information?uuid=${uuid}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) throw new Error('Gagal mengambil data pasien');

                const data = await response.json();
                setData(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPatientData();
    }, [uuid]);


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
                visit_number: visitNumber,
                date: data?.visit_date,
                time: data?.visit_time,
                subjective: subjective,
                objective: objective,
                assessment: assessment,
                plan: plan,
                weight: weight,
                height: height,
                heart_rate: heartRate,
                respiratory_rate: respiratoryRate,
                temperature: temperature,
                record_id: data?.record_id
            };
            const response = await axios.post("http://localhost:5000/api/visit-report/add-visit-pregnancy", payload, {
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
                fetchVisitNumber();

            } router.push('/daily-report');
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
        <div className="w-full flex flex-col px-10 mt-7 ">
            <div className="flex flex-col gap-2">
                <input
                    type="text"
                    value={visitNumber}
                    readOnly
                    className="bg-transparent font-mono font-bold cursor-not-allowed focus:outline-none text-3xl text-[#4F6F52] w-full"
                />
                <p className="text-[10px] text-gray-400">*Otomatis oleh sistem</p>
            </div>
            <div className="flex-1 flex flex-col py-10 gap-6">
                <div className="flex flex-row gap-10 w-full ">
                    <div className="flex flex-col flex-1 text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Medical Record</label>
                        <div
                            style={{ backgroundColor: '#C3C3C3' }}
                            className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
                        >
                            {data?.record_number || ""}
                        </div>
                    </div>
                    <div className="flex flex-col flex-1 text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Tipe Kunjungan</label>
                        <div
                            style={{ backgroundColor: '#C3C3C3' }}
                            className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
                        >
                            {data?.record_type || ""}
                        </div>
                    </div>
                    <div className="flex flex-col flex-1 text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Tanggal Kunjungan</label>
                        <div
                            style={{ backgroundColor: '#C3C3C3' }}
                            className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
                        >
                            {data?.visit_date || ""}
                        </div>
                    </div>
                    <div className="flex flex-col flex-1 text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Waktu</label>
                        <div
                            style={{ backgroundColor: '#C3C3C3' }}
                            className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
                        >
                            {data?.visit_time || ""}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex flex-col flex-1 text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Nama Pasien</label>
                        <div
                            style={{ backgroundColor: '#C3C3C3' }}
                            className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
                        >
                            {data?.patient_name || ""}
                        </div>
                    </div>
                </div>
            </div>
            <div className="border-b-2 text-[#D9D9D9] font-bold"> <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">Tanda Vital</p></div>
            <div className="flex-1 flex flex-col py-5 gap-6">
                <div className="flex flex-row gap-10 w-full ">
                    <div className="flex flex-col flex-1 text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Berat</label>
                        <input type="text" name="weight" value={weight} onChange={(e) => setWeight(e.target.value)} id="weight" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                    <div className="flex flex-col flex-1 text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Tinggi</label>
                        <input type="text" name="height" value={height} onChange={(e) => setHeight(e.target.value)} id="height" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>

                    <div className="flex flex-col flex-1 text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Tekanan Darah</label>
                        <input type="text" name="blood_pressure" value={bloodPressure} onChange={(e) => setBloodPressure(e.target.value)} id="blood_pressure" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                    <div className="flex flex-col flex-1 text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Suhu Badan</label>
                        <input type="text" name="temperature" value={temperature} onChange={(e) => setTemperature(e.target.value)} id="temperature" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>

                </div>
                <div className="flex flex-row gap-10">
                    <div className="flex flex-col text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Frekuensi Pernapasan</label>
                        <input type="text" name="respiratory_rate" value={respiratoryRate} onChange={(e) => setRespiratoryRate(e.target.value)} id="respiratory_rate" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                    <div className="flex flex-col text-sm gap-2">
                        <label className="block mb-1 font-bold text-black">Detak Jantung</label>
                        <input type="text" name="heart_rate" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} id="heart_rate" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                </div>
            </div>
            <div className="border-b-2 text-[#D9D9D9] font-bold"> <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">SOAP</p></div>
            <div className="flex-1 flex flex-col py-5 gap-6">
                <div className="flex flex-col text-sm gap-2">
                    <label className="block mb-1 font-bold text-black">Subjective</label>
                    <textarea name="subjective" value={subjective} onChange={(e) => setSubjective(e.target.value)} id="subjective" className="w-full h-30 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </div>
                <div className="flex flex-col text-sm gap-2">
                    <label className="block mb-1 font-bold text-black">Objective</label>
                    <textarea name="objective" value={objective} onChange={(e) => setObjective(e.target.value)} id="objective" className="w-full h-30 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </div>
                <div className="flex flex-col text-sm gap-2">
                    <label className="block mb-1 font-bold text-black">Assessment</label>
                    <textarea name="assessment" value={assessment} onChange={(e) => setAssessment(e.target.value)} id="assessment" className="w-full h-30 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </div>
                <div className="flex flex-col text-sm gap-2">
                    <label className="block mb-1 font-bold text-black">Plan</label>
                    <textarea name="plan" value={plan} onChange={(e) => setPlan(e.target.value)} id="plan" className="w-full h-30 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </div>
            </div>
          
            
            <div className="flex justify-center gap-4 mt-10">
                <button
                    onClick={handleSubmit}
                    type="submit"
                    className="px-8 py-2 bg-[#739072] text-white rounded-full hover:bg-[#4F6F52] shadow-lg transition font-bold cursor-pointer"
                >
                    Simpan Kunjungan Baru
                </button>
            </div>
        </div >
    )

}
export default AddVisitPregnancy;
