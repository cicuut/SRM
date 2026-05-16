"use client";
import { useEffect, useMemo } from "react";
import { useState } from "react";
import { useParams, useRouter } from "next/dist/client/components/navigation";
import VisitInformation from "@/components/visit/visit-information";
import api from "@/utils/app";
import Swal from "sweetalert2";

// Data shape for immunization visit details
interface VisitImmunizationDetailProps {
  weight_kg?: string;
  height_cm?: string;
  vaccine_given?: string;
  dosage_given?: string;
  body_temperature?: string;
  head_circumference?: string;
  abdominal_circumference?: string;
  finance?: {
    invoice_number?: string;
    total_amount?: number;
    payment_method?: string;
    status?: string;
  };
}

interface MedicalForm {
  weight_kg: string;
  height_cm: string;
  vaccine_given: string;
  dosage_given: string;
  body_temperature: string;
  head_circumference: string;
  abdominal_circumference: string;
  finance?: {
    invoice_number?: string;
    total_amount?: number;
    payment_method?: string;
    status?: string;
  };
}

const VisitImmunizationDetail = () => {
  // Local state for visit details and loading/error status
  const [visitImmunizationDetail, setVisitImmunizationDetail] =
    useState<VisitImmunizationDetailProps | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const uuid = params.id;

  const [formData, setFormData] = useState<MedicalForm>({
    weight_kg: "",
    height_cm: "",
    vaccine_given: "",
    dosage_given: "",
    body_temperature: "",
    head_circumference: "",
    abdominal_circumference: "",
  });

  const [originalFormData, setOriginalFormData] = useState<MedicalForm | null>(
    null,
  );

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

  const doseOptions = {
    HBO: ["Dosis 1"],
    BCG: ["Dosis 1"],
    POLIO: ["Polio 1", "Polio 2", "Polio 3", "Polio 4"],
    DPT: ["DPT 1", "DPT 2", "DPT 3"],
    PCV: ["PCV 1", "PCV 2", "PCV 3"],
    CAMPAK: ["Campak 1", "Campak 2"],
    IPV: ["IPV 1", "IPV 2"],
    ROTAVIRUS: ["Rotavirus 1", "Rotavirus 2", "Rotavirus 3"],
  };

  useEffect(() => {
    const fetchVisitImmunizationData = async () => {
      if (!uuid) return;
      try {
        const response = await api.get(
          `/visit-report/get-visit-immunization/${uuid}`,
        );
        const data = response.data;
        setVisitImmunizationDetail(data);
        const initialFormValues = {
          weight_kg: data?.weight_kg || "",
          height_cm: data?.height_cm || "",
          vaccine_given: data?.vaccine_given || "",
          dosage_given: data?.dosage_given || "",
          body_temperature: data?.body_temperature || "",
          head_circumference: data?.head_circumference || "",
          abdominal_circumference: data?.abdominal_circumference || "",
        };

        setFormData(initialFormValues);
        setOriginalFormData(initialFormValues);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVisitImmunizationData();
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
        `/visit-report/update-visit-immunization/${uuid}`,
        formData,
      );
      if (response.status === 200) {
        await Swal.fire({
          title: "Berhasil Disimpan",
          text: "Perubahan data Imunisasi berhasil disimpan!",
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
      <div className="p-8 text-center text-[#739072] font-bold animate-pulse">
        Sedang mengambil data medis
      </div>
    );

  if (error)
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Error: {error}
      </div>
    );

  return (
    <div className="min-h-screen mt-10 flex flex-col bg-[#FDFEF9] w-full">
      <VisitInformation />

      <div className="rounded-[14px] border border-[#D2D8CF] bg-white shadow-sm mt-5">
        <div className="border-b border-[#E4E8E1] px-5 py-4">
          <h2 className="text-[16px] font-bold text-[#4F6F52]">
            Catatan Medis
          </h2>
          <p className="mt-1 text-[11px] text-[#6B6B6B]">
            Informasi ini dapat diubah, silakan ketik untuk memperbarui catatan
            medis pasien{" "}
          </p>
        </div>

        <div className="flex-1 flex flex-col py-5 px-5 gap-6">
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Berat Badan (kg)
              </span>
              <input
                name="weight_kg"
                value={formData.weight_kg}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan berat badan pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Tinggi Badan (cm)
              </span>
              <input
                name="height_cm"
                value={formData.height_cm}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Contoh: 120/80 mmHg"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Suhu Tubuh
              </span>
              <input
                name="body_temperature"
                value={formData.body_temperature}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Contoh: 36.5"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Lingkar Kepala
              </span>
              <input
                name="head_circumference"
                value={formData.head_circumference}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Contoh: 36.5"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Lingkar Perut (cm)
              </span>
              <input
                name="abdominal_circumference"
                value={formData.abdominal_circumference}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Contoh: 36.5"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Vaksin
              </span>
              <select
                name="vaccine_given"
                value={formData.vaccine_given}
                onChange={(e) => {
                  // Ketika jenis vaksin berubah, kosongkan juga isian dosis sebelumnya
                  setFormData((prev) => ({
                    ...prev,
                    vaccine_given: e.target.value,
                    dosage_given: "",
                  }));
                }}
                className="mt-1 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
              >
                <option value="" disabled hidden>
                  Pilih Jenis Vaksin
                </option>
                <option value="HBO">HBO</option>
                <option value="BCG">BCG</option>
                <option value="POLIO">POLIO</option>
                <option value="DPT">DPT</option>
                <option value="PCV">PCV</option>
                <option value="CAMPAK">CAMPAK</option>
                <option value="IPV">IPV</option>
                <option value="ROTAVIRUS">ROTAVIRUS</option>
              </select>
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Dosis
              </span>
              <select
                name="dosage_given"
                value={formData.dosage_given}
                onChange={handleInputChange}
                disabled={!formData.vaccine_given}
                className={`mt-1 h-[42px] w-full rounded-[10px] border px-3 text-[13px] text-black outline-none transition-all ${
                  !formData.vaccine_given
                    ? "bg-gray-100 border-gray-200 cursor-not-allowed text-gray-400"
                    : "bg-white border-[#D2D8CF] focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
                }`}
              >
                <option value="">Pilih Dosis</option>
                {formData.vaccine_given &&
                  doseOptions[
                    formData.vaccine_given as keyof typeof doseOptions
                  ]?.map((dose) => (
                    <option key={dose} value={dose}>
                      {dose}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>

        <div className="border-t border-[#E4E8E1] px-5 py-4">
          <h2 className="text-[16px] font-bold text-[#4F6F52]">
            Data Pembayaran
          </h2>
          <p className="text-[11px] text-[#6B6B6B]">
            Informasi pembayaran untuk kunjungan ini (tidak dapat diubah di
            sini).
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Nomor Transaksi
              </span>
              <input
                type="text"
                value={visitImmunizationDetail?.finance?.invoice_number || ""}
                readOnly
                className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Total Transaksi
              </span>
              <input
                type="text"
                value={
                  visitImmunizationDetail?.finance?.total_amount
                    ? `Rp ${visitImmunizationDetail.finance.total_amount.toLocaleString()}`
                    : ""
                }
                readOnly
                className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Metode Pembayaran
              </span>
              <input
                type="text"
                value={visitImmunizationDetail?.finance?.payment_method || ""}
                readOnly
                className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Status Pembayaran
              </span>
              <input
                type="text"
                value={visitImmunizationDetail?.finance?.status || ""}
                readOnly
                className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
              />
            </label>
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-[#E4E8E1] px-5 py-4 sm:flex-row sm:items-center sm:justify-between mt-6 bg-white rounded-[14px] border border-[#D2D8CF] shadow-sm">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isSaving || isDeleting}
          className="h-[38px] rounded-[30px] border border-red-200 bg-white px-5 text-[12px] font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hapus Kunjungan
        </button>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {isChanged ? (
            <button
              type="button"
              onClick={handleCancelChanges}
              className="h-[38px] rounded-[30px] border border-gray-300 bg-white px-5 text-[12px] font-bold text-gray-600 hover:bg-gray-50 animate-in fade-in duration-200"
            >
              Batal Perubahan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/daily-report")}
              disabled={isSaving || isDeleting}
              className="h-[38px] rounded-[30px] border border-[#BFC7BB] bg-white px-5 text-[12px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Kembali
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving || isDeleting || !isChanged}
            className="h-[38px] rounded-[30px] bg-[#739072] px-5 text-[12px] font-bold text-white hover:bg-[#5F785F] disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          >
            {isSaving ? "Menyimpan" : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
};
export default VisitImmunizationDetail;
