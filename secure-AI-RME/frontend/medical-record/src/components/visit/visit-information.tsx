"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import api from "@/utils/app";

interface PatientInformationDetailList {
  rm_number?: string;
  patient_name: string;
  made_by: string;
  visit_date: string;
  nik: string;
}

const formatDateForInput = (dateString: string | undefined | null) => {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return ""; 

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); 
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const VisitInformation = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;
  const [visitData, setVisitData] =
    useState<PatientInformationDetailList | null>(null);

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!uuid) return;
      try {
        const response = await api.get(`/visit-report/get-visit-data/${uuid}`);
        const data = response.data;
        setVisitData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [uuid]);


  if (error)
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  return (
    <div className="w-full">
      <div className="rounded-[14px] border border-[#D2D8CF] bg-white shadow-sm">
        <div className="border-b border-[#E4E8E1] px-5 py-4">
          <h2 className="text-[16px] font-bold text-[#4F6F52]">
            Data Pemilik Kunjungan
          </h2>
          <p className="mt-1 text-[11px] text-[#6B6B6B]">
            Data ini tidak dapat diubah, hanya untuk informasi pemilik kunjungan
            medis ini
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="text-[12px] font-bold text-[#2F3A2F">
              Nama Pasien
            </span>

            <input
              type="text"
              name="patient_name"
              value={visitData?.patient_name || ""}
              readOnly
              className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-[#2F3A2F">NIK </span>

            <input
              type="text"
              name="nik"
              value={visitData?.nik || ""}
              readOnly
              className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-bold text-[#2F3A2F">
              Nomor Rekam Medis
            </span>
            <input
              type="text"
              value={visitData?.rm_number || "-"}
              readOnly
              className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-bold text-[#2F3A2F">
              Tanggal Kunjungan
            </span>
            <input
              type="date"
              name="visit_date"
              value={formatDateForInput(visitData?.visit_date)}
              readOnly
              className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-bold text-[#2F3A2F">
              Dibuat Oleh{" "}
            </span>

            <input
              type="text"
              name="made_by"
              value={visitData?.made_by || ""}
              readOnly
              className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default VisitInformation;
