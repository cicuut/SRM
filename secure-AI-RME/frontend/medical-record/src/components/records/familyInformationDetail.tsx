'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from 'js-cookie';
import { useParams } from "next/navigation";
import api from "@/utils/app";

interface FamilyInformationDetailList {
    patient_name?: string;
    nik: string;
    birthdate: string;
    gender: string;
    age: string;
    patient_number: string;
    address: string;
    education: string;
    occupation: string;
    relation: string;
}

const FamilyInformation = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;
    const [patientData, setPatientData] = useState<FamilyInformationDetailList | null>(null);


    useEffect(() => {
        const fetchPatientData = async () => {
            if (!uuid) return;
            try {
                const response = await api.get(`/medical-record/get-family-data/${uuid}` );
                const data = response.data;
                setPatientData(data);
            } catch (err: any) {
            const msg = err.response?.data?.msg || err.message || "Terjadi kesalahan";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };
        fetchPatientData();
    }, [uuid]);

    if (loading) return <div className="p-8 text-center text-blue-600 animate-pulse">Sedang mengambil data</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    return (
        <div className="w-full">
            <table className="w-[100%] text-left border-separate">
                <tbody>
                    <tr>
                        <td className=" w-40">Nama Lengkap</td>
                        <td className="w-4">:</td>
                        <td className="w-80">{patientData?.patient_name}</td>
                        <td className=" w-40 ">Nomor Telepon</td>
                        <td className="w-4">:</td>
                        <td className="">{patientData?.patient_number}</td>
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
                        <td className=" ">Pendidikan</td>
                        <td>:</td>
                        <td className="">{patientData?.education}</td>
                    </tr>
                    <tr>
                        <td className=" ">Umur</td>
                        <td>:</td>
                        <td className="">{patientData?.age} tahun</td>
                        <td className=" ">Pekerjaan</td>
                        <td>:</td>
                        <td className="">{patientData?.occupation}</td>
                    </tr>
                    <tr>
                        <td className=" ">Jenis Kelamin</td>
                        <td>:</td>
                        <td className="">{patientData?.gender}</td>
                        <td className=" ">Hubungan</td>
                        <td>:</td>
                        <td className="">{patientData?.relation}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    )

}
export default FamilyInformation;
