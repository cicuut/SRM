"use client";
import { useEffect, useState, useMemo } from "react";
import VisitInformation from "@/components/visit/visit-information";
import { useParams, useRouter } from "next/navigation"; // FIX: Gunakan useRouter App Router Next.js 13+
import api from "@/utils/app";
import Swal from "sweetalert2";

interface VisitGeneralDetailProps {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  visit_id?: string;
  finance?: {
    invoice_number?: string;
    total_amount?: number;
    payment_method?: string;
    status?: string;
  };
}

interface SOAPFormData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const VisitGeneralDetail = () => {
  const [visitGeneralDetail, setVisitGeneralDetail] =
    useState<VisitGeneralDetailProps | null>(null);

  // FIX: Deklarasikan state formData dan originalFormData dengan interface yang jelas
  const [formData, setFormData] = useState<SOAPFormData>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [originalFormData, setOriginalFormData] = useState<SOAPFormData | null>(
    null,
  );

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const router = useRouter();
  const uuid = params.id;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isChanged = useMemo(() => {
    if (!originalFormData) return false;
    return JSON.stringify(originalFormData) !== JSON.stringify(formData);
  }, [formData, originalFormData]);

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!uuid) return;
      try {
        setLoading(true);
        const response = await api.get(
          `/visit-report/get-visit-general/${uuid}`,
        );
        const data = response.data;

        setVisitGeneralDetail(data);

        const initialFormValues = {
          subjective: data?.subjective || "",
          objective: data?.objective || "",
          assessment: data?.assessment || "",
          plan: data?.plan || "",
        };

        setFormData(initialFormValues);
        setOriginalFormData(initialFormValues);
      } catch (err: any) {
        setError(
          err.response?.data?.msg || err.message || "Gagal memuat rekam medis",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchPatientData();
  }, [uuid]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
        `/visit-report/update-visit-general/${uuid}`,
        formData,
      );
      if (response.status === 200) {
        await Swal.fire({
          title: "Berhasil Disimpan",
          text: "Perubahan data berhasil disimpan!",
          icon: "success",
          timer: 1400,
          showConfirmButton: false,
          confirmButtonColor: "#739072",
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

  const handleDelete = async () => {
    if (!uuid) return;
    try {
      setIsDeleting(true);
      setError("");
      const response = await api.delete(`/visit-report/delete-visit/${uuid}`);

      if (response.status === 200 || response.status === 204) {
        setShowDeleteConfirm(false);

        await Swal.fire({
          title: "Berhasil Dihapus",
          text: "Data kunjungan pasien telah dihapus dari sistem.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });

        router.push("/daily-report");
      }
    } catch (error: any) {
      console.error("Delete Error:", error);
      const message =
        error.response?.data?.msg ||
        error.message ||
        "Terjadi kesalahan saat menghapus kunjungan";

      setError(message);
      setShowDeleteConfirm(false);

      Swal.fire({
        title: "Gagal Menghapus!",
        text: message,
        icon: "error",
        confirmButtonColor: "#739072",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-[#739072] font-bold animate-pulse">
        Sedang mengambil data medis...
      </div>
    );

  if (error)
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Error: {error}
      </div>
    );

  return (
    <div className="min-h-screen mt-5 flex flex-col bg-[#FDFEF9] w-full">
      <VisitInformation />

      <div className="rounded-[14px] border border-[#D2D8CF] bg-white shadow-sm mt-5">
        <div className="border-b border-[#E4E8E1] px-5 py-4">
          <h2 className="text-[16px] font-bold text-[#4F6F52]">
            Catatan Medis
          </h2>
          <p className="mt-1 text-[11px] text-[#6B6B6B]">
            Informasi ini dapat diubah, silakan ketik untuk memperbarui catatan
            medis pasien
          </p>
        </div>

        {/* Form Input Medis SOAP (Berubah dari Input biasa ke Textarea agar ramah ketikan panjang) */}
        <div className="flex-1 flex flex-col py-5 px-5 gap-6">
          {/* SUBJECTIVE */}
          <label className="flex flex-col text-sm gap-2">
            <span className="text-[12px] font-bold text-[#2F3A2F]">
              Subjective
            </span>
            <textarea
              name="subjective"
              value={formData.subjective}
              onChange={handleInputChange}
              rows={3}
              className="mt-2 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
              placeholder="Masukkan data subjektif..."
            />
          </label>

          {/* OBJECTIVE */}
          <label className="flex flex-col text-sm gap-2">
            <span className="text-[12px] font-bold text-[#2F3A2F]">
              Objective
            </span>
            <textarea
              name="objective"
              value={formData.objective}
              onChange={handleInputChange}
              rows={3}
              className="mt-2 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
              placeholder="Masukkan data objektif..."
            />
          </label>

          {/* ASSESSMENT */}
          <label className="flex flex-col text-sm gap-2">
            <span className="text-[12px] font-bold text-[#2F3A2F]">
              Assessment
            </span>
            <textarea
              name="assessment"
              value={formData.assessment}
              onChange={handleInputChange}
              rows={3}
              className="mt-2 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
              placeholder="Masukkan assessment..."
            />
          </label>

          {/* PLAN */}
          <label className="flex flex-col text-sm gap-2">
            <span className="text-[12px] font-bold text-[#2F3A2F]">Plan</span>
            <textarea
              name="plan"
              value={formData.plan}
              onChange={handleInputChange}
              rows={3}
              className="mt-2 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
              placeholder="Masukkan rencana tindakan..."
            />
          </label>
        </div>

        {/* Data Pembayaran (Read-Only) */}
        <div className="border-t border-[#E4E8E1] px-5 py-4">
          <h2 className="text-[16px] font-bold text-[#4F6F52]">
            Data Pembayaran
          </h2>
          <p className="text-[12px] text-[#6B6B6B]">
            Informasi pembayaran untuk kunjungan ini (tidak dapat diubah di
            sini)
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Nomor Transaksi
              </span>
              <input
                type="text"
                value={visitGeneralDetail?.finance?.invoice_number || ""}
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
                  visitGeneralDetail?.finance?.total_amount
                    ? `Rp ${visitGeneralDetail.finance.total_amount.toLocaleString()}`
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
                value={visitGeneralDetail?.finance?.payment_method || ""}
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
                value={visitGeneralDetail?.finance?.status || ""}
                readOnly
                className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
              />
            </label>
          </div>
        </div>
      </div>

      {/* FOOTER NAVIGASI DAN SUBMIT PERUBAHAN GLOBAL */}
      <div className="flex flex-col-reverse gap-3 border-t  px-5 py-4 sm:flex-row sm:items-center sm:justify-between mt-6 bg-white rounded-[14px] border border-[#D2D8CF] shadow-sm">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isSaving || isDeleting}
          className="h-[38px] rounded-[30px] border border-red-200 bg-white px-5 text-[12px] font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hapus Kunjungan
        </button>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {/* Jika data berubah, tombol Kembali berubah peran menjadi tombol Batal Perubahan */}
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
            {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[420px] rounded-2xl bg-white px-6 py-6 shadow-xl">
            <h2 className="text-[20px] font-bold text-[#2F3A2F]">
              Hapus Data Kunjungan?
            </h2>

            <p className="mt-3 text-[13px] leading-relaxed text-[#4B4B4B]">
              Data kunjungan akan dihapus dari penyimpanan. Aksi ini tidak bisa
              dibatalkan.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="h-[38px] rounded-[30px] border border-[#BFC7BB] bg-white px-5 text-[12px] font-bold text-[#4B4B4B] hover:bg-[#F4F4F4] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-[38px] rounded-[30px] bg-red-600 px-5 text-[12px] font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default VisitGeneralDetail;
