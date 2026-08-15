"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import VisitInformation from "@/components/visit/visit-information";
import api from "@/utils/app";
import Swal from "sweetalert2";

interface VisitFamilyPlanningDetailProps {
  weight_kg?: string;
  blood_pressure?: string;
  contraceptive_method?: string;
  complaint?: string;
  return_visit_date?: string;
  finance?: {
    invoice_number?: string;
    total_amount?: number;
    payment_method?: string;
    status?: string;
    items?: Array<{
      item_name: string;
      quantity: number;
      unit_cost: number;
    }>;
  };
}

interface MedicalForm {
  weight_kg: string;
  blood_pressure: string;
  contraceptive_method: string;
  complaint: string;
  return_visit_date: string;
}

const formatRupiah = (value: number | string | undefined | null) => {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number.isNaN(numericValue) ? 0 : numericValue);
};

const VisitFamilyPlanningDetail = () => {
  const [visitFamilyPlanningDetail, setVisitFamilyPlanningDetail] =
    useState<VisitFamilyPlanningDetailProps | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const router = useRouter();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const uuid = params.id;
  const [visitStatus, setVisitStatus] = useState<string>("");
  const [userRole, setUserRole] = useState("");
  const finance = visitFamilyPlanningDetail?.finance;
  const billingItems = finance?.items || [];

  const [formData, setFormData] = useState<MedicalForm>({
    weight_kg: "",
    blood_pressure: "",
    contraceptive_method: "",
    complaint: "",
    return_visit_date: "",
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
  useEffect(() => {
    const role = localStorage.getItem("user_role") || "";
    setUserRole(role.toLowerCase());
  }, []);

  const fetchVisitFamilyPlanningData = async () => {
    if (!uuid) return;
    try {
      setLoading(true);
      const response = await api.get(
        `/visit-report/get-visit-family-planning/${uuid}`,
      );
      const data = response.data;

      setVisitFamilyPlanningDetail(data);

      const initialFormValues = {
        weight_kg: data?.weight_kg || "",
        blood_pressure: data?.blood_pressure || "",
        contraceptive_method: data?.contraceptive_method || "",
        complaint: data?.complaint || "",
        return_visit_date: formatDate(data?.return_visit_date) || "",
      };

      setFormData(initialFormValues);
      setOriginalFormData(initialFormValues);
      const statusFromApi = (response.data.status || "pending")
        .toLowerCase()
        .trim();
      setVisitStatus(statusFromApi);
    } catch (err: any) {
      setError(
        err.response?.data?.msg || err.message || "Gagal mengambil data",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchVisitFamilyPlanningData();
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
        `/visit-report/update-visit-family-planning/${uuid}`,
        formData,
      );
      if (response.status === 200) {
        await Swal.fire({
          title: "Berhasil Disimpan",
          text: "Perubahan data berhasil disimpan!",
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

  const handleApprove = async () => {
    const result = await Swal.fire({
      title: "Setujui Kunjungan?",
      text: "Data kunjungan ini akan diubah statusnya menjadi Approved.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#739072",
      cancelButtonColor: "#d33",
      confirmButtonText: "Ya!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        await api.patch(`/visit-report/approve/${uuid}`);

        setVisitStatus("approved");

        Swal.fire({
          title: "Berhasil!",
          text: "Kunjungan telah disetujui.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });

        fetchVisitFamilyPlanningData();
      } catch (err: any) {
        Swal.fire({
          title: "Gagal!",
          text: err.response?.data?.msg || "Terjadi kesalahan saat approve.",
          icon: "error",
        });
      } finally {
        setLoading(false);
      }
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
  const handleVisitInfoLoaded = (visitData: any) => {
    if (visitData?.status) {
      setVisitStatus(visitData.status.toLowerCase().trim());
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
    <div className="min-h-screen mt-5 flex flex-col bg-[#FDFEF9] w-full">
      <VisitInformation onDataLoaded={handleVisitInfoLoaded} />

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
                Tekanan Darah (mmHg)
              </span>
              <input
                name="blood_pressure"
                value={formData.blood_pressure}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Contoh: 120/80 mmHg"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Metode Kontraseptif
              </span>
              <select
                name="contraceptive_method"
                value={formData.contraceptive_method}
                onChange={handleInputChange}
                className="mt-1 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
              >
                <option value="" disabled hidden>
                  Pilih Metode Kontraseptif
                </option>

                <option value="PIL">PIL</option>
                <option value="Suntik 1 Bulan">Suntik 1 Bulan</option>
                <option value="Suntik 3 Bulan">Suntik 3 Bulan</option>
                <option value="IUD">IUD</option>
                <option value="Inplan">Inplan</option>
              </select>
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Tanggal Kunjungan Kembali
              </span>
              <input
                name="return_visit_date"
                value={formData.return_visit_date}
                onChange={handleInputChange}
                type="date"
                className="mt-2 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Masukkan rencana tanggal kembali"
              />
            </label>
          </div>
          <label className="flex flex-col text-sm gap-2">
            <span className="text-[12px] font-bold text-[#2F3A2F]">
              Keluhan Pasien / Catatan
            </span>
            <textarea
              name="complaint"
              value={formData.complaint}
              onChange={handleInputChange}
              rows={3}
              className="mt-1 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
              placeholder="Masukkan detail keluhan"
            />
          </label>
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
                value={visitFamilyPlanningDetail?.finance?.invoice_number || ""}
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
                  visitFamilyPlanningDetail?.finance?.total_amount
                    ? `Rp ${visitFamilyPlanningDetail.finance.total_amount.toLocaleString()}`
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
                value={visitFamilyPlanningDetail?.finance?.payment_method || ""}
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
                value={visitFamilyPlanningDetail?.finance?.status || ""}
                readOnly
                className="mt-2 h-[42px] w-full cursor-not-allowed rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] text-[#5F5F5F] outline-none"
              />
            </label>
            <div className="rounded-[12px] border border-[#D2D8CF] bg-white p-4 md:col-span-2 xl:col-span-4 mt-2">
              <h3 className="text-[14px] font-bold text-[#4F6F52]">
                Rincian Biaya
              </h3>

              {billingItems.length === 0 ? (
                <p className="mt-2 text-[12px] text-gray-500 italic">
                  Tidak ada rincian biaya untuk kunjungan ini.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {billingItems.map((item, index) => {
                    const itemSubtotal = item.quantity * item.unit_cost;

                    return (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-2 rounded-[10px] border border-[#E4E8E1] bg-[#F8FAF6] p-3 md:grid-cols-[1fr_100px_150px_150px]"
                      >
                        <div>
                          <span className="block text-[10px] font-bold text-[#777]">
                            Layanan / Item
                          </span>
                          <span className="text-[13px] font-medium text-[#2F3A2F]">
                            {item.item_name}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] font-bold text-[#777]">
                            Jumlah
                          </span>
                          <span className="text-[13px] font-medium text-[#2F3A2F]">
                            {item.quantity}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] font-bold text-[#777]">
                            Biaya per Item
                          </span>
                          <span className="text-[13px] font-medium text-[#2F3A2F]">
                            {formatRupiah(item.unit_cost)}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] font-bold text-[#777]">
                            Subtotal
                          </span>
                          <span className="text-[13px] font-bold text-[#2F3A2F]">
                            {formatRupiah(itemSubtotal)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
          {visitStatus === "pending" && userRole === "midwife" && (
            <button
              onClick={handleApprove}
              disabled={loading}
              className="px-6 py-2 bg-[#739072] text-white rounded-full font-semibold hover:bg-[#4F6F52] shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Memproses..." : "Setujui Kunjungan"}
            </button>
          )}
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

export default VisitFamilyPlanningDetail;
