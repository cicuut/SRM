"use client";
import React, { useEffect } from "react";
import { useState } from "react";
import { emit } from "process";
import VisitInformation from "@/components/visit/visit-information";
import { useParams } from "next/dist/client/components/navigation";
import Cookies from "js-cookie";
import api from "@/utils/app";

interface VisitGeneralDetailProps {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}
const visitGeneralDetail = () => {
  const [visitGeneralDetail, setVisitGeneralDetail] =
    useState<VisitGeneralDetailProps | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!uuid) return;
      try {
        const response = await api.get(
          `/visit-report/get-visit-general/${uuid}`,
        );
        const data = response.data;
        setVisitGeneralDetail(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPatientData();
  }, [uuid]);

  if (loading)
    return (
      <div className="p-8 text-center  text-[#739072]  animate-pulse">
        Sedang mengambil data medis...
      </div>
    );
  if (error)
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  return (
    <div className="min-h-screen mt-10 flex flex-col bg-[#FDFEF9] w-full">
      <VisitInformation />

      <div className="flex border-b border-gray-200 gap-6 mt-10">
        <p className="border-b-2 border-[#739072] text-[#739072] font-bold">
          Catatan Medis
        </p>
      </div>
      <div className="flex-1 flex flex-col py-5 gap-6">
        <div className="flex flex-col text-sm gap-2">
          <label className="block mb-1 font-bold text-black">Subjective</label>
          <div className="w-full h-30 p-2 overflow-y-auto text-wrap rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitGeneralDetail?.subjective}
          </div>
        </div>
        <div className="flex flex-col text-sm gap-2">
          <label className="block mb-1 font-bold text-black">Objective</label>
          <div className="w-full h-30 p-2 rounded-md overflow-y-auto text-wrap  bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitGeneralDetail?.objective}
          </div>
        </div>
        <div className="flex flex-col text-sm gap-2">
          <label className="block mb-1 font-bold text-black">Assessment</label>
          <div className="w-full h-30 p-2 rounded-md  overflow-y-auto text-wrap  bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitGeneralDetail?.assessment}
          </div>
        </div>
        <div className="flex flex-col text-sm gap-2">
          <label className="block mb-1 font-bold text-black">Plan</label>
          <div className="w-full h-30 p-2 rounded-md  overflow-y-auto text-wrap  bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitGeneralDetail?.plan}
          </div>
        </div>
      </div>
    </div>
  );
};
export default visitGeneralDetail;
