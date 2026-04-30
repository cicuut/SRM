"use client";
import React, { useEffect } from "react";
import { useState } from "react";
import { emit } from "process";
import VisitInformation from "@/components/visit/visit-information";
import { useParams } from "next/dist/client/components/navigation";
import Cookies from "js-cookie";

interface VisitPregnancyDetailProps {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  weight?: string;
  height?: string;
  blood_pressure?: string;
  body_temperature?: string;
  heart_rate?: string;
  respiratory_rate?: string;
}
const VisitPregnancyDetail = () => {
  const [visitPregnancyDetail, setVisitPregnancyDetail] =
    useState<VisitPregnancyDetailProps | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!uuid) return;
      try {
        const token = Cookies.get("access_token");
        const response = await fetch(
          `http://localhost:5000/api/visit-report/get-visit-pregnancy/${uuid}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) throw new Error("Gagal mengambil data pasien");

        const data = await response.json();
        setVisitPregnancyDetail(data);
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
      <div className="p-8 text-center text-blue-600 animate-pulse">
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
        <table className="w-full">
          <tbody>
            <tr>
              <td className="w-[15%]">Berat</td>
              <td className="w-[2%]">:</td>
              <td>{visitPregnancyDetail?.weight} kg</td>
            </tr>
             <tr>
              <td>Tinggi</td>
              <td>:</td>
              <td>{visitPregnancyDetail?.height} cm</td>
            </tr>
             <tr>
              <td>Tekanan Darah</td>
              <td>:</td>
              <td>{visitPregnancyDetail?.blood_pressure} mmHg</td>
            </tr>
             <tr>
              <td>Suhu Tubuh</td>
              <td>:</td>
              <td>{visitPregnancyDetail?.body_temperature} °C</td>
            </tr>
             <tr>
              <td>Frekuensi Pernapasan</td>
              <td>:</td>
              <td>{visitPregnancyDetail?.respiratory_rate} / menit</td>
            </tr>
            <tr>
              <td>Detak Jantung</td>
              <td>:</td>
              <td>{visitPregnancyDetail?.heart_rate} bpm</td>
            </tr>
          </tbody>
        </table>
        <div className="flex flex-col text-sm gap-2">
          <label className="block mb-1 font-bold text-black">Subjective</label>
          <div className="w-full h-30 p-2 overflow-y-auto text-wrap rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitPregnancyDetail?.subjective}
          </div>
        </div>
        <div className="flex flex-col text-sm gap-2">
          <label className="block mb-1 font-bold text-black">Objective</label>
          <div className="w-full h-30 p-2 rounded-md overflow-y-auto text-wrap  bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitPregnancyDetail?.objective}
          </div>
        </div>
        <div className="flex flex-col text-sm gap-2">
          <label className="block mb-1 font-bold text-black">Assessment</label>
          <div className="w-full h-30 p-2 rounded-md  overflow-y-auto text-wrap  bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitPregnancyDetail?.assessment}
          </div>
        </div>
        <div className="flex flex-col text-sm gap-2">
          <label className="block mb-1 font-bold text-black">Plan</label>
          <div className="w-full h-30 p-2 rounded-md  overflow-y-auto text-wrap  bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitPregnancyDetail?.plan}
          </div>
        </div>
      </div>
    </div>
  );
};
export default VisitPregnancyDetail;
