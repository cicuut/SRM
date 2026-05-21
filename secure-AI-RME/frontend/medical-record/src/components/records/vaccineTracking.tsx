"use client";
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from "js-cookie";
import { useParams } from "next/navigation";
import api from "@/utils/app";

interface VaccineList {
  hbo_1?: string;
  bcg_1?: string;
  polio_1?: string;
  polio_2?: string;
  polio_3?: string;
  polio_4?: string;
  dpt_1?: string;
  dpt_2?: string;
  dpt_3?: string;
  dpt_4?: string;
  pcv_1?: string;
  pcv_2?: string;
  pcv_3?: string;
  campak_1?: string;
  campak_2?: string;
  ipv_1?: string;
  ipv_2?: string;
  rotavirus_1?: string;
  rotavirus_2?: string;
  rotavirus_3?: string;
}

const VaccineTracking = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;
  const [data, setData] = useState<VaccineList | null>(null);

  const ImmuneBox = ({ title, doses }: { title: string; doses: string[] }) => (
    <div className="border border-gray-400 text-center min-w-25">
      <div className="bg-[#e9f0e8] py-1 border-b border-gray-400 font-bold text-xs uppercase">
        {title}
      </div>
      <div className="flex divide-x divide-gray-400">
        {doses.map((date, idx) => (
          <div key={idx} className="flex-1 flex flex-col min-w-25">
            <div className="bg-[#f0f4ef] py-1 border-b border-gray-400 text-[10px]">
              {idx + 1}
            </div>
            <div className="h-10 flex items-center justify-center bg-white p-1 text-[10px] font-medium">
              {date || "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!uuid) return;
      try {
        const response = await api.get(
          `/medical-record/get-immunization-record-data/${uuid}`,
        );
        const data = response.data;
        setData(data);
      } catch (err: any) {
        const msg =
          err.response?.data?.msg || err.message || "Terjadi kesalahan";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
    <div className="w-full flex flex-row gap-10 ">
      <div className="rounded-[14px] border border-[#D2D8CF] bg-white shadow-sm">
        <div className="border-b border-[#E4E8E1] px-5 py-4">
          <h2 className="text-[16px] font-bold text-[#4F6F52]">
            Informasi Vaksin 
          </h2>
          <p>Tidak dapat diedit, edit hanya dapat dilakukan melalui data kunjungan</p>
        </div>
        <div className="flex flex-wrap gap-4 p-4 justify-center">
          <ImmuneBox title="HB0" doses={[data?.hbo_1 || ""]} />
          <ImmuneBox title="BCG" doses={[data?.bcg_1 || ""]} />

          <ImmuneBox
            title="POLIO"
            doses={[
              data?.polio_1 || "",
              data?.polio_2 || "",
              data?.polio_3 || "",
              data?.polio_4 || "",
            ]}
          />

          <ImmuneBox
            title="DPT"
            doses={[
              data?.dpt_1 || "",
              data?.dpt_2 || "",
              data?.dpt_3 || "",
              data?.dpt_4 || "",
            ]}
          />

          <ImmuneBox
            title="PCV"
            doses={[data?.pcv_1 || "", data?.pcv_2 || "", data?.pcv_3 || ""]}
          />

          <ImmuneBox
            title="CAMPAK"
            doses={[data?.campak_1 || "", data?.campak_2 || ""]}
          />

          <ImmuneBox
            title="IPV"
            doses={[data?.ipv_1 || "", data?.ipv_2 || ""]}
          />
          <ImmuneBox
            title="ROTAVIRUS"
            doses={[
              data?.rotavirus_1 || "",
              data?.rotavirus_2 || "",
              data?.rotavirus_3 || "",
            ]}
          />
        </div>
      </div>
    </div>
  );
};
export default VaccineTracking;
