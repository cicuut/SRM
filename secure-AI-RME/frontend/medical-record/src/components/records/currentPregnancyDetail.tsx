'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from 'js-cookie';
import { useParams } from "next/navigation";
import api from "@/utils/app";

interface CurrentPregnancyList {
    current_pregnancy: {
        last_menstrual_period?: string;
        expected_due_date?: string;
        diagnosis?: string;
    }
}

const CurrentPregnancyDetail = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;
    const [data, setData] = useState<CurrentPregnancyList | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!uuid) return;
            try {
                const response = await api.get(`/medical-record/get-pregnancy-record-data/${uuid}`);
                const data = response.data();
                setData(data);
            } catch (err: any) {
                setError(err.message);
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
                        <td className="w-70">Hari Pertama Haid Terakhir</td>
                        <td className="w-4">:</td>
                        <td className="w-50">{data?.current_pregnancy.last_menstrual_period}</td>
                        <td className=" w-40 ">Tanggal Estimasi Persalinan</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.current_pregnancy.expected_due_date}</td>
                    </tr>
                    <tr className="h-10 align-center">
                        <td className=" ">Diagnosis</td>
                        <td colSpan={5}>:</td>
                    </tr>
                    <tr className="align-center">
                        <td colSpan={6} className="p-2 bg-white h-50 drop-shadow-lg rounded-lg align-top">{data?.current_pregnancy.diagnosis}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
export default CurrentPregnancyDetail;