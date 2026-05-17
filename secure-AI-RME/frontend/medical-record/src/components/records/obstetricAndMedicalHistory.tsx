"use client";
import React, { useMemo } from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from "js-cookie";
import { useParams, useRouter } from "next/navigation";
import api from "@/utils/app";
import Swal from "sweetalert2";

interface ObstectricAndMedicalRecordList {
  number_of_children?: string;
  youngest_child_age?: string;
  family_med_history?: string;
}

const ObstectricAndMedicalRecord = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;
  const [data, setData] = useState<ObstectricAndMedicalRecordList | null>(null);
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<ObstectricAndMedicalRecordList>({
    number_of_children: "",
    youngest_child_age: "",
    family_med_history: "",
  });

  const [originalFormData, setOriginalFormData] =
    useState<ObstectricAndMedicalRecordList | null>(null);

  const isChanged = useMemo(() => {
    if (!originalFormData) return false;
    return JSON.stringify(originalFormData) !== JSON.stringify(formData);
  }, [formData, originalFormData]);
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!uuid) return;
      try {
        const response = await api.get(
          `/medical-record/get-family-planning-record-data/${uuid}`,
        );

        const data = response.data;
        setData(data);

        const structuredData: ObstectricAndMedicalRecordList = {
          number_of_children: data?.number_of_children || "",
          youngest_child_age: data?.youngest_child_age || "",
          family_med_history: data?.family_med_history || "",
        };

        setFormData(structuredData);
        setOriginalFormData(structuredData);
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

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancelChanges = () => {
    if (originalFormData) {
      setFormData(originalFormData);
    }
  };

  const handleSaveAll = async () => {
    if (!uuid) return;
    try {
      setIsSaving(true);
      const response = await api.put(
        `/medical-record/update-family-planning-record-data/${uuid}`,
        formData,
      );
      if (response.status === 200) {
        await Swal.fire({
          title: "Berhasil Disimpan",
          text: "Perubahan data KB berhasil disimpan!",
          icon: "success",
          timer: 1400,
          showConfirmButton: false,
        });

        setOriginalFormData(formData);
      }
    } catch (err: any) {
      alert(
        err.response?.data?.msg || err.message || "Gagal menyimpan perubahan",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-[#4F6F52] animate-pulse">
        Sedang mengambil data
      </div>
    );
  if (error)
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="w-full">
      <div className="rounded-[14px] border border-[#D2D8CF] bg-white shadow-sm">
        <div className="border-b border-[#E4E8E1] px-5 py-4">
          <h2 className="text-[16px] font-bold text-[#4F6F52]">
            Riwayat Kehamilan dan Medis
          </h2>
        </div>

        <div className="flex-1 flex flex-col py-5 px-5 gap-6">
          <div className=" grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Jumlah Anak
              </span>
              <input
                name="number_of_children"
                value={formData.number_of_children}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan jumlah anak"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Umur Anak Termuda
              </span>
              <input
                name="youngest_child_age"
                value={formData.youngest_child_age}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan umur anak termuda"
              />
            </label>

            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Penyakit Genetik dalam Keluarga
              </span>
              <input
                name="family_med_history"
                value={formData.family_med_history}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan riwayat penyakit genetik dalam keluarga"
              />
            </label>
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-[#D2D8CF] px-5 py-4 sm:flex-row sm:items-center sm:justify-between mt-6 bg-white rounded-[14px] border shadow-sm">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isSaving || isDeleting}
          className="h-9.5 rounded-[30px] border border-red-200 bg-white px-5 text-[12px] font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hapus Kunjungan
        </button>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {isChanged ? (
            <button
              type="button"
              onClick={handleCancelChanges}
              className="h-9.5 rounded-[30px] border border-gray-300 bg-white px-5 text-[12px] font-bold text-gray-600 hover:bg-gray-50 animate-in fade-in duration-200"
            >
              Batal Perubahan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/medical-record")}
              disabled={isSaving || isDeleting}
              className="h-9.5 rounded-[30px] border border-[#BFC7BB] bg-white px-5 text-[12px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Kembali
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving || isDeleting || !isChanged}
            className="h-9.5 rounded-[30px] bg-[#739072] px-5 text-[12px] font-bold text-white hover:bg-[#5F785F] disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          >
            {isSaving ? "Menyimpan" : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
};
export default ObstectricAndMedicalRecord;
