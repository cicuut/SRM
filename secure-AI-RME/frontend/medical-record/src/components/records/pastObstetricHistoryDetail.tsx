'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from 'js-cookie';
import { useParams } from "next/navigation";

interface CurrentPregnancyList {
    current_pregnancy: {
        pre_preg_weight_kg?: string;
        pre_preg_muac_cm?: string;
        contraceptive_history: string;
        family_med_history: string;
    };
    past_obstetric_history: PastObstetricHistoryDetailList[];
}

interface PastObstetricHistoryDetailList {
    pregnancy_no?: string;
    gestational_age?: string;
    pregnancy_complications?: string;
    delivery_mode?: string;
    delivery_complications?: string;
    baby_weight_height?: string;
    baby_complications?: string;
    postpartum_status?: string;
    postpartum_complications?: string;

}

const PastObstecticHistoryDetail = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;
    const [data, setData] = useState<CurrentPregnancyList | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!uuid) return;
            try {
                const token = Cookies.get('access_token');
                const response = await fetch(`http://localhost:5000/api/medical-record/get-pregnancy-record-data/${uuid}`, {
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
            <table className="w-full text-left border-separate">
                <tbody>
                    <tr>
                        <td className="w-70">Berat Badan Sebelum Hamil</td>
                        <td className="w-4">:</td>
                        <td className="w-50">{data?.current_pregnancy.pre_preg_weight_kg} kg</td>
                        <td className=" w-40 ">Riwayat Kontrasepsi</td>
                        <td className="w-4">:</td>
                        <td className="">{data?.current_pregnancy.contraceptive_history}</td>
                    </tr>
                    <tr>
                        <td className=" ">Lingkar Lengan Atas Sebelum Hamil</td>
                        <td>:</td>
                        <td className="">{data?.current_pregnancy.pre_preg_muac_cm} cm</td>
                        <td className=" ">Riwayat Penyakit Genetik</td>
                        <td>:</td>
                        <td className="">{data?.current_pregnancy.family_med_history}</td>
                    </tr>
                </tbody>
            </table>
            {data?.past_obstetric_history && data.past_obstetric_history.length > 0 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 mt-5 duration-500">
                    {data.past_obstetric_history.map((item, index) => (
                        <div key={index}  >
                            <h3 className="font-bold text-[#739072] mb-4">Kehamilan Ke-{index + 1}</h3>
                            <div className="flex flex-col mt-4 gap-y-4">
                                <div className="flex flex-row w-full gap-20 justify-between">
                                    <div className="flex flex-col flex-1 gap-1">
                                        Usia Kehamilan
                                        <input type="text" value={item.gestational_age} readOnly className="p-2 w-full h-8 rounded-md bg-white  border border-gray-300 focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col flex-1 gap-1 ">
                                        Cara Persalinan
                                        <input type="text" value={item.delivery_mode} readOnly className="p-2 w-full h-8 rounded-md bg-white  border border-gray-300 focus:outline-none" />
                                    </div>
                                </div>
                                <div className="flex flex-row w-full gap-20 justify-between">
                                    <div className="flex flex-col flex-1 gap-1 ">
                                        Komplikasi Kehamilan
                                        <textarea value={item.pregnancy_complications} readOnly className="p-2 w-full h-50 rounded-md bg-white border border-gray-300 focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col flex-1 gap-1 ">
                                        Komplikasi Persalinan
                                        <textarea value={item.delivery_complications} readOnly className="p-2 w-full h-50 rounded-md bg-white border border-gray-300 focus:outline-none" />
                                    </div>
                                </div>
                                <div className="flex flex-row w-full gap-20 justify-between">
                                    <div className="flex flex-col flex-1 gap-1 ">
                                        Berat dan Panjang Badan Bayi
                                        <input type="text" value={item.baby_weight_height} readOnly className="p-2 w-full h-8 rounded-md bg-white  border border-gray-300 focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col flex-1 gap-1 ">
                                        Masa Nifas
                                        <input type="text" value={item.postpartum_status} readOnly className="p-2 w-full h-8 rounded-md bg-white  border border-gray-300 focus:outline-none" />
                                    </div>
                                </div>
                                <div className="flex flex-row w-full gap-20 justify-between">
                                    <div className="flex flex-col flex-1 gap-1 ">
                                        Komplikasi Bayi
                                        <textarea value={item.baby_complications} readOnly className="p-2 w-full h-50 rounded-md bg-white border border-gray-300 focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col flex-1 gap-1 ">
                                        Komplikasi Nifas
                                        <textarea value={item.postpartum_complications} readOnly className="p-2 w-full h-50 rounded-md bg-white border border-gray-300 focus:outline-none" />
                                    </div>
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
export default PastObstecticHistoryDetail;