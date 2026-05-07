'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from 'js-cookie';
import { useParams } from "next/navigation";
import api from "@/utils/app";

interface CurrentPregnancyList {
    current_pregnancy: {
        registration_date?: string;
        tt_screening?: string;
        height_cm?: string;
        weight_kg?: string;
        lab_results?: string;
        muac_cm?: string;
    }
}

const GeneralExainationDetail = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;
    const [data, setData] = useState<CurrentPregnancyList | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!uuid) return;
            try {
                const response = await api.get(`/medical-record/get-pregnancy-record-data/${uuid}` );
                const data = response.data;
                setData(data);
            }catch (err: any) {
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
            <table className="w-full text-left border-separate">
                <tbody>
                    <tr className="h-5 align-center">
                        <td className="w-40">Hari Kunjungan Pertama</td>
                        <td className="w-4">:</td>
                        <td className="w-80">{data?.current_pregnancy.registration_date}</td>
                        <td className=" w-40 ">TT Screening</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.current_pregnancy.tt_screening}</td>
                    </tr>
                    <tr className="h-5 align-center">
                        <td >Tinggi Badan</td>
                        <td> :</td>
                        <td >{data?.current_pregnancy.height_cm} cm</td>
                        <td  >Berat Badan</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.current_pregnancy.weight_kg} kg</td>
                    </tr>
                    <tr className="h-5 align-center">
                        <td className=" w-40 ">Lingkar Lengan Atas</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.current_pregnancy.muac_cm} cm</td>
                    </tr>
                    <tr className="h-5 align-center">
                        <td className=" ">Hasil Lab</td>
                        <td colSpan={5}>:</td>
                    </tr>
                    <tr className="align-center">
                        <td colSpan={6} className="p-2 bg-white h-50 drop-shadow-lg rounded-lg align-top">{data?.current_pregnancy.lab_results}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
export default GeneralExainationDetail;