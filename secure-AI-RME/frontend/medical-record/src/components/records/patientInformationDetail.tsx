'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from 'js-cookie';
import { useParams } from "next/navigation";

interface PatientInformationDetailList {
    patient_name?: string;
    nik: string;
    birthdate: string;
    gender: string;
    age: string;
    patient_number: string;
    address: string;
    type: string;
    education: string;
    occupation: string;
    bpjs_number: string;
    primary_healthcare: string;
}

const PatientInformationDetail = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;
    const [patientData, setPatientData] = useState<PatientInformationDetailList | null>(null);


    useEffect(() => {
        const fetchPatientData = async () => {
            if (!uuid) return;
            try {
                const token = Cookies.get('access_token');
                const response = await fetch(`http://localhost:5000/api/medical-record/get-patient-data/${uuid}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) throw new Error('Gagal mengambil data pasien');

                const data = await response.json();
                setPatientData(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPatientData();
    }, [uuid]);

    if (loading) return <div className="p-8 text-center text-blue-600 animate-pulse">Sedang mengambil data medis...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    return (
        <div className="w-full">
            <table className="w-[100%] text-left border-separate">
                <tbody>
                    <tr>
                        <td className=" w-40">Nama Lengkap</td>
                        <td className="w-4">:</td>
                        <td className="w-80">{patientData?.patient_name}</td>
                        <td className=" w-40 ">Tipe Pasien</td>
                        <td className="w-4">:</td>
                        <td className="">{patientData?.type}</td>
                    </tr>
                    <tr>
                        <td className=" ">NIK</td>
                        <td>:</td>
                        <td className="">{patientData?.nik}</td>
                        <td className=" ">Alamat</td>
                        <td>:</td>
                        <td className="">{patientData?.address}</td>
                    </tr>
                    <tr>
                        <td className=" ">Tanggal Lahir</td>
                        <td>:</td>
                        <td className="">{patientData?.birthdate}</td>  
                        <td className=" ">Education</td>
                        <td>:</td>
                        <td className="">{patientData?.education}</td>
                    </tr>
                     <tr>
                        <td className=" ">Umur</td>
                        <td>:</td>
                        <td className="">{patientData?.age}</td>  
                        <td className=" ">Pekerjaan</td>
                        <td>:</td>
                        <td className="">{patientData?.occupation}</td>
                    </tr>
                      <tr>
                        <td className=" ">Nomor Telepon</td>
                        <td>:</td>
                        <td className="">{patientData?.patient_number}</td>  
                        <td className=" ">Nomor BPJS</td>
                        <td>:</td>
                        <td className="">{patientData?.bpjs_number}</td>
                    </tr>
                      <tr>
                        <td className=" ">Jenis Kelamin</td>
                        <td>:</td>
                        <td className="">{patientData?.gender}</td>  
                        <td className=" ">Faskes Tingkat Pertama</td>
                        <td>:</td>
                        <td className="">{patientData?.primary_healthcare}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    )

}
export default PatientInformationDetail;
