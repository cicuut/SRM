"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Cookies from "js-cookie";
import PregnancyDetail from "@/app/(pages)/medical-record/(medical-record-detail)/pregnancyDetail";
import { Cookie } from "next/font/google";
import FamilyPlanningDetail from "@/app/(pages)/medical-record/(medical-record-detail)/familyPlanningDetail";
import ImmunizationDetail from "@/app/(pages)/medical-record/(medical-record-detail)/immunizationDetail";
import DeliveryDetail from "@/app/(pages)/medical-record/(medical-record-detail)/deliveryDetail";
import GeneralDetail from "../(medical-record-detail)/generalDetail";
import api from "@/utils/app";
import LoadingOverlay from "@/components/loading";

export default function MedicalRecordDetailPage() {
  const params = useParams();
  const id = params.id;
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const respons = await api.get(`/medical-record/get-record/${id}`);
        if (respons.status === 200) {
          const data = respons.data;
          setRecord(data);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.msg || err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDetail();
  }, [id]);
  const renderSpecificUI = () => {
    if (!record) return null;

    switch (record.record_type) {
      case "Kehamilan":
        return <PregnancyDetail {...record.details} />;
      case "Keluarga Berencana":
        return <FamilyPlanningDetail {...record.details} />;
      case "Imunisasi":
        return <ImmunizationDetail {...record.details} />;
      case "Persalinan":
        return <DeliveryDetail {...record.details} />;
      case "Umum":
        return <GeneralDetail {...record.details} />;
      default:
        return <div className="p-4">Tipe rekam medis tidak dikenali.</div>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#FDFEF9]">
        {loading && <LoadingOverlay />}
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-5xl mx-auto p-6">Rekam medis tidak ditemukan.</div>
    );
  }

  return (
    <div className="w-full mx-auto  ">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#D2D8CF] bg-white px-5 py-4 shadow-sm">
        <div>
          <h1 className="text-[20px] font-bold text-[#4F6F52]">
            Detail Rekam Medis
          </h1>

          <p className="mt-1 text-[12px] text-[#6B6B6B]">
            Informasi Lengkap Rekam Medis{" "}
          </p>
        </div>

        <div className="rounded-[10px] bg-[#F8FAF6] px-4 py-3 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#739072]">
            Nomor Rekam Medis
          </p>

          <p className="mt-1 text-[16px] font-bold text-[#2F3A2F]">
            {record.record_number}
          </p>
        </div>
      </div>

      <div className="">{renderSpecificUI()}</div>
    </div>
  );
}
