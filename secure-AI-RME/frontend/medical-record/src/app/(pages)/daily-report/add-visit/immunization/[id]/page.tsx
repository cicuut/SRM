'use client';
import React from "react";
import { useState } from "react";
import Cookies from 'js-cookie';
import axios from "axios";
import { useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import api from "@/utils/app";

interface AddVisitImmunizationProps {
    record_id?: string;
    record_type?: string;
    patient_name?: string;
    record_number?: string;
    visit_date?: string;
    visit_time?: string;
}

const AddVisitImmunization = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const id = params.id;
    const router = useRouter();
    const [visitNumber, setVisitNumber] = useState("Generating Visit Number");
    const [weight, setWeight] = useState("");
    const [height, setHeight] = useState("");
    const [temperature, setTemperature] = useState("");
    const [headCircumference, setHeadCircumference] = useState("");
    const [abdominalCircumference, setAbdominalCircumference] = useState("");
    const [vaccine_given, setVaccineGiven] = useState("");
    const [dosage_given, setDosageGiven] = useState("");
    const uuid = params.id;
    const [data, setData] = useState<AddVisitImmunizationProps | null>(null);

    const fetchVisitNumber = async () => {
        try {
            const response = await api.get(
                `/visit-report/visit-number`
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
                const response = await api.get(`/visit-report/get-visit-information?uuid=${uuid}`);
                const data = response.data;
                setData(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPatientData();
    }, [uuid]);

    const doseOptions = {
        "HBO": ["Dosis 1"],
        "BCG": ["Dosis 1"],
        "POLIO": ["Polio 1", "Polio 2", "Polio 3", "Polio 4"],
        "DPT": ["DPT 1", "DPT 2", "DPT 3"],
        "PCV": ["PCV 1", "PCV 2", "PCV 3"],
        "CAMPAK": ["Campak 1", "Campak 2"],
        "IPV": ["IPV 1", "IPV 2"],
        "ROTAVIRUS": ["Rotavirus 1", "Rotavirus 2", "Rotavirus 3"]
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const payload = {
                visit_number: visitNumber,
                date: data?.visit_date,
                time: data?.visit_time,
                weight_kg: weight,
                height_cm: height,
                record_id: uuid,
                vaccine_given: vaccine_given,
                body_temperature: temperature,
                head_circumference: headCircumference,
                abdominal_circumference: abdominalCircumference,
                dosage_given: dosage_given
            };
            const response = await api.post(`/visit-report/add-visit-immunization`, payload );

            if (response.status === 201) {
                await Swal.fire({
                    title: "Success",
                    text: "Data Imunisasi berhasil disimpan!",
                    icon: "success",
                     showConfirmButton: false,
                    timer: 2000
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
                  showConfirmButton: false,
                timer: 2000
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
            <div className="flex-1 flex flex-row py-5 gap-6">
                <div className="flex flex-col flex-1 text-sm gap-2">
                    <label className="block mb-1 font-bold text-black">Berat</label>
                    <input type="number"  placeholder="Tanpa satuan"  name="weight" value={weight} onChange={(e) => setWeight(e.target.value)} id="weight" className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </div>
                <div className="flex flex-col flex-1 text-sm gap-2 ">
                    <label className="block mb-1 font-bold text-black">Tinggi</label>
                    <input type="number" placeholder="Tanpa satuan" name="height" value={height} onChange={(e) => setHeight(e.target.value)} id="height" className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </div>
                <div className="flex flex-col flex-1 text-sm gap-2">
                    <label className="block mb-1 font-bold text-black">Suhu Tubuh</label>
                    <input type="number"  placeholder="Tanpa satuan" name="temperature" value={temperature} onChange={(e) => setTemperature(e.target.value)} id="temperature" className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </div>
            </div>
            <div className="flex-1 flex flex-row py-5 gap-6">
                <div className="flex flex-col flex-1 text-sm gap-2">
                    <label className="block mb-1 font-bold text-black">Lingkar Kepala</label>
                    <input type="number"  placeholder="Tanpa satuan" name="head_circumference" value={headCircumference} onChange={(e) => setHeadCircumference(e.target.value)} id="head_circumference" className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </div>
                <div className="flex flex-col flex-1 text-sm gap-2 ">
                    <label className="block mb-1 font-bold text-black">Lingkar Perut</label>
                    <input type="number"  placeholder="Tanpa satuan" name="abdominal_circumference" value={abdominalCircumference} onChange={(e) => setAbdominalCircumference(e.target.value)} id="abdominal_circumference" className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                </div>
            </div>
            <div className="border-b-2 text-[#D9D9D9] font-bold"> <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">Pemberian Imunisasi</p></div>
            <div className="flex-1 flex flex-col py-5 gap-6">
                <div className="flex flex-row gap-x-10  w-full ">
                    <div className="flex flex-col text-sm gap-2 min-w-[200px] ">
                        <label className="block mb-1 font-bold text-black">Pemberian Imunisasi</label>

                        <select value={vaccine_given} onChange={(e) => {
                            setVaccineGiven(e.target.value);
                            setDosageGiven("");
                        }} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                            <option value="" disabled>Pilih</option>
                            <option value="HBO">HBO</option>
                            <option value="BCG">BCG</option>
                            <option value="POLIO">POLIO</option>
                            <option value="DPT">DPT</option>
                            <option value="PCV">PCV</option>
                            <option value="CAMPAK">CAMPAK</option>
                            <option value="IPV">IPV</option>
                            <option value="ROTAVIRUS">ROTAVIRUS</option>
                        </select>
                    </div>

                    <div className="flex flex-col text-sm gap-2 min-w-[200px] ">
                        <label className="block mb-1 font-bold text-black">Dosis</label>
                        <select
                            value={dosage_given}
                            onChange={(e) => setDosageGiven(e.target.value)}
                            disabled={!vaccine_given}
                            className={`w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 ${!vaccine_given ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Pilih Dosis</option>
                            {vaccine_given && doseOptions[vaccine_given as keyof typeof doseOptions]?.map((dose) => (
                                <option key={dose} value={dose}>
                                    {dose}
                                </option>
                            ))}
                        </select>
                    </div>
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
export default AddVisitImmunization;
