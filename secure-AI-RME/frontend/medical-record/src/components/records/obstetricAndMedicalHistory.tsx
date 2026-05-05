'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from 'js-cookie';
import { useParams } from "next/navigation";
import api from "@/utils/app";

interface ObstectricAndMedicalRecordList {
    number_of_children?: string;
    youngest_child_age?: string;
    family_med_history?: string;

}

const ObstectricAndMedicalRecord = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;
    const [data, setData] = useState<ObstectricAndMedicalRecordList | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!uuid) return;
            try {
                const response = await api.get(`/medical-record/get-family-planning-record-data/${uuid}`);

                const data = response.data();
                setData(data);
            }  catch (err: any) {
            const msg = err.response?.data?.msg || err.message || "Terjadi kesalahan";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };
        fetchData();
    }, [uuid]);

    if (loading) return <div className="p-8 text-center text-blue-600 animate-pulse">Sedang mengambil data medis...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    return (
        <div className="w-full">
            <table className="w-[100%] text-left border-separate">
                <tbody>
                    <tr className="h-5 align-center">
                        <td className="w-70">Jumlah Anak</td>
                        <td className="w-4">:</td>
                        <td className="w-50">{data?.number_of_children}</td>
                        <td className=" w-40 ">Umur Anak Termuda</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.youngest_child_age}</td>
                    </tr>
                    <tr className="h-10 align-center">
                        <td className=" ">Penyakit Genetik dalam Keluarga</td>
                        <td colSpan={5}>:</td>
                    </tr>
                    <tr className="align-center">
                        <td colSpan={6} className="p-2 bg-white h-50 drop-shadow-lg rounded-lg align-top">{data?.family_med_history}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
export default ObstectricAndMedicalRecord;