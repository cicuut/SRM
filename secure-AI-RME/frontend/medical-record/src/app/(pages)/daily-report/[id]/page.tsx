"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Cookies from "js-cookie";
import VisitPregnancyDetail from "../visit-detail/pregnancyDetail";
import VisitFamilyPlanningDetail from "../visit-detail/familyPlanningDetail";
import VisitImmunizationDetail from "../visit-detail/immunizationDetail";
import VisitGeneralDetail from "../visit-detail/generalDetail";
import api from "@/utils/app";
import LoadingOverlay from "@/components/loading";
export default function VisitDetailPage() {
  const params = useParams();
  const id = params.id;
  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await api.get(`/visit-report/get-visit-report/${id}`);
        if (response.status === 200) {
          const data = response.data;
          setVisit(data);
        }
      } catch (err: any) {
        const msg =
          err.response?.data?.msg || err.message || "Terjadi kesalahan";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDetail();
  }, [id]);
  const renderSpecificUI = () => {
    if (!visit) return null;

    switch (visit.visit_type) {
      case "Kehamilan":
        return <VisitPregnancyDetail {...visit.details} />;
      case "Keluarga Berencana":
        return <VisitFamilyPlanningDetail {...visit.details} />;
      case "Imunisasi":
        return <VisitImmunizationDetail {...visit.details} />;
      case "Umum":
        return <VisitGeneralDetail {...visit.details} />;
      default:
        return <div className="p-4">Tipe rekam medis tidak dikenali.</div>;
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }
  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center">
        <p className="text-red-500 font-semibold">
          Gagal memuat rekam medis: {error}
        </p>
      </div>
    );
  }
  if (!visit) {
    return (
      <div className="max-w-5xl mx-auto p-6">Rekam medis tidak ditemukan.</div>
    );
  }

  return (
    <div className="w-full mx-auto  ">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#D2D8CF] bg-white px-5 py-4 shadow-sm">
        <div>
          <h1 className="text-[20px] font-bold text-[#4F6F52]">
            Detail Kunjungan
          </h1>

          <p className="mt-1 text-[12px] text-[#6B6B6B]">
            Informasi lengkap mengenai kunjungan medis
          </p>
        </div>

        <div className="rounded-[10px] bg-[#F8FAF6] px-4 py-3 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#739072]">
           Nomor Kunjungan
          </p>

          <p className="mt-1 text-[16px] font-bold text-[#2F3A2F]">
            {visit.visit_number}
          </p>
        </div>
      </div>

      <div className="">{renderSpecificUI()}</div>
    </div>
  );
}
