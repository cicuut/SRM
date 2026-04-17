'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from 'js-cookie';
import { useParams } from "next/navigation";

interface NewbornHistoryDetailList {
   baby_gender?: string;
   vit_k_given?: boolean;
   baby_weight?: string;
   hbo_given?: boolean;
   baby_length?: string;
   apgar_score?: string;
   eye_ointment?: boolean;
   imd?: boolean;
   baby_complications?: string;
}

const NewbornHistoryDetail = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;
    const [data, setData] = useState<NewbornHistoryDetailList | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!uuid) return;
            try {
                const token = Cookies.get('access_token');
                const response = await fetch(`http://localhost:5000/api/medical-record/get-delivery-record-data/${uuid}`, {
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

        fetchData();
    }, [uuid]);

    if (loading) return <div className="p-8 text-center text-blue-600 animate-pulse">Sedang mengambil data medis...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    return (
        <div className="w-full">
            <table className="w-[100%] text-left border-separate">
                <tbody>
                    <tr className="h-5 align-center">
                        <td className="w-70">Jenis Kelamin Bayi</td>
                        <td className="w-4">:</td>
                        <td className="w-50">{data?.baby_gender}</td>
                        <td className=" w-40 ">Pemberian Vitamin K</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.vit_k_given ? "Sudah" : "Belum"}</td>
                    </tr>
                       <tr className="h-5 align-center">
                        <td className="w-70">Berat Bayi</td>
                        <td className="w-4">:</td>
                        <td className="w-50">{data?.baby_weight} gram</td>
                        <td className=" w-40 ">Pemberian HBO</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.hbo_given ? "Sudah" : "Belum"}</td>
                    </tr>
                       <tr className="h-5 align-center">
                        <td className="w-70">Panjang Bayi</td>
                        <td className="w-4">:</td>
                        <td className="w-50">{data?.baby_length} cm</td>
                        <td className=" w-40 ">Pemberian Salap Mata</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.eye_ointment ? "Sudah" : "Belum"}</td>
                    </tr>
                     <tr className="h-5 align-center">
                        <td className="w-70">APGAR Score</td>
                        <td className="w-4">:</td>
                        <td className="w-50">{data?.apgar_score}</td>
                        <td className=" w-40 ">Pemberian IMD</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.imd ? "Sudah" : "Belum"}</td>
                    </tr>
                    <tr className="h-10 align-center">
                        <td className=" ">Komplikasi Bayi</td>
                        <td colSpan={5}>:</td>
                    </tr>
                    <tr className="align-center">
                        <td colSpan={6} className="p-2 bg-white h-50 drop-shadow-lg rounded-lg align-top">{data?.baby_complications}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
export default NewbornHistoryDetail;