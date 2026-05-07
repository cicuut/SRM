'use client';
import React, { useEffect } from "react";
import { useState } from "react";
import { emit } from "process";
import { useParams } from "next/dist/client/components/navigation";
import VisitInformation from "@/components/visit/visit-information";
import Cookies from "js-cookie";
import api from "@/utils/app";

interface VisitFamilyPlanningDetailProps {
    weight_kg?: string;
    blood_pressure?: string;
    contraceptive_method?: string;
    complaint?: string;
    return_visit_date?: string;
}

const VisitFamilyPlanningDetail = () => {
    const [visitFamilyPlanningDetail, setVisitFamilyPlanningDetail] =
        useState<VisitFamilyPlanningDetailProps | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;


    useEffect(() => {
        const fetchVisitFamilyPlanningData = async () => {
            if (!uuid) return;
            try {
                const response = await api.get(
                    `/visit-report/get-visit-family-planning/${uuid}`
                );
                const data = response.data;
                setVisitFamilyPlanningDetail(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchVisitFamilyPlanningData();
    }, [uuid]);
    return (
        <div className="min-h-screen mt-10 flex flex-col bg-[#FDFEF9] w-full">
            <VisitInformation />
            <div className="flex border-b border-gray-200 gap-6 mt-10">
                <p className="border-b-2 border-[#739072] text-[#739072] font-bold">
                    Catatan Medis
                </p>
            </div>
            <div className=" flex flex-row py-5 gap-6">
                <div className="flex flex-col text-sm gap-2 min-w-[200px]">
                    <label className="block mb-1 font-bold text-black">Berat Badan</label>
                    <div className="w-full  p-2 overflow-y-auto text-wrap rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitFamilyPlanningDetail?.weight_kg}
                    </div>
                </div>
                <div className="flex flex-col text-sm gap-2 min-w-[200px]">
                    <label className="block mb-1 font-bold text-black">Tekanan Darah</label>
                    <div className="w-full  p-2 overflow-y-auto text-wrap rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitFamilyPlanningDetail?.blood_pressure}
                    </div>
                </div>
            </div>
            <div className="flex flex-row py-5 gap-6">
                <div className="flex flex-col text-sm gap-2 min-w-[200px] ">
                    <label className="block mb-1 font-bold text-black">Metode KB</label>
                    <div className="w-full p-2 rounded-md  overflow-y-auto text-wrap   bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitFamilyPlanningDetail?.contraceptive_method}
                    </div>
                </div>
                <div className="flex flex-col text-sm gap-2 min-w-[200px]">
                    <label className="block mb-1 font-bold text-black">Kunjungan Berikutnya</label>
                    <div className="w-full  p-2 rounded-md  overflow-y-auto text-wrap bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitFamilyPlanningDetail?.return_visit_date}
                    </div>
                </div>
            </div>
            <div className="flex flex-col text-sm gap-2">
                <label className="block mb-1 font-bold text-black">Keluhan</label>
                <div className="w-full h-30 p-2 rounded-md  overflow-y-auto text-wrap  bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                    {visitFamilyPlanningDetail?.complaint}
                </div>
            </div>
        </div>

    )

}
export default VisitFamilyPlanningDetail;
