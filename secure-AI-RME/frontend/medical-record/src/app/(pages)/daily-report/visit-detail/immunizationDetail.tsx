'use client';
import React, { useEffect } from "react";
import { useState } from "react";
import { emit } from "process";
import { useParams } from "next/dist/client/components/navigation";
import VisitInformation from "@/components/visit/visit-information";
import Cookies from "js-cookie";
import api from "@/utils/app";

interface VisitImmunizationDetailProps {
    weight_kg?: string;
    height_cm?: string;
    vaccine_given?: string;
    dosage_given?: string;
    body_temperature?: string;
    head_circumference?: string;
    abdominal_circumference?: string;
}
const VisitImmunizationDetail = () => {
    const [visitImmunizationDetail, setVisitImmunizationDetail] =
        useState<VisitImmunizationDetailProps | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;


    useEffect(() => {
        const fetchVisitImmunizationData = async () => {
            if (!uuid) return;
            try {
                const response = await api.get(
                    `/visit-report/get-visit-immunization/${uuid}`
                );
                const data =response.data();
                setVisitImmunizationDetail(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchVisitImmunizationData();
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
                        {visitImmunizationDetail?.weight_kg}
                    </div>
                </div>
                <div className="flex flex-col text-sm gap-2 min-w-[200px]">
                    <label className="block mb-1 font-bold text-black">Tinggi Badan</label>
                    <div className="w-full  p-2 overflow-y-auto text-wrap rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitImmunizationDetail?.height_cm}
                    </div>
                </div>
                 <div className="flex flex-col text-sm gap-2 min-w-[200px]">
                    <label className="block mb-1 font-bold text-black">Suhu Tubuh</label>
                    <div className="w-full  p-2 overflow-y-auto text-wrap rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitImmunizationDetail?.body_temperature}
                    </div>
                </div>
            </div>
            <div className="flex flex-row py-5 gap-6">
                <div className="flex flex-col text-sm gap-2 min-w-[200px] ">
                    <label className="block mb-1 font-bold text-black">Lingkar Kepala</label>
                    <div className="w-full p-2 rounded-md  overflow-y-auto text-wrap   bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitImmunizationDetail?.head_circumference}
                    </div>
                </div>
                <div className="flex flex-col text-sm gap-2 min-w-[200px]">
                    <label className="block mb-1 font-bold text-black">Lingkar Perut</label>
                    <div className="w-full  p-2 rounded-md  overflow-y-auto text-wrap bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitImmunizationDetail?.abdominal_circumference}
                    </div>
                </div>
            </div>
            <div className="flex flex-col text-sm gap-2">
                <div className="flex flex-col text-sm gap-2 min-w-[200px]">
                    <label className="block mb-1 font-bold text-black">Imunisasi</label>
                    <div className="w-full  p-2 rounded-md  overflow-y-auto text-wrap bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitImmunizationDetail?.vaccine_given}
                    </div>
                </div>
                <div className="flex flex-col text-sm gap-2 min-w-[200px]">
                    <label className="block mb-1 font-bold text-black">Dosis</label>
                    <div className="w-full  p-2 rounded-md  overflow-y-auto text-wrap bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                        {visitImmunizationDetail?.dosage_given}
                    </div>
                </div>
            </div>
        </div>

    )

}
export default VisitImmunizationDetail;
