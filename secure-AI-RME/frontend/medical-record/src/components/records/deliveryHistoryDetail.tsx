"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/utils/app";
import Swal from "sweetalert2";


interface DeliverHistoryDetailList {
  delivery_date?: string;
  delivery_type?: string;
  deliver_complications?: string;
  baby_gender?: string;
  vit_k_given?: boolean;
  baby_weight?: string;
  hbo_given?: boolean;
  baby_length?: string;
  apgar_score?: string;
  eye_ointment?: boolean;
  imd?: boolean;
  baby_complications?: string;
}

const DeliverHistoryDetail = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;
  const router = useRouter();
  const [data, setData] = useState<DeliverHistoryDetailList | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<DeliverHistoryDetailList>({
    delivery_date: "",
    delivery_type: "",
    deliver_complications: "",
    baby_gender: "",
    vit_k_given: false,
    baby_weight: "",
    hbo_given: false,
    baby_length: "",
    apgar_score: "",
    eye_ointment: false,
    imd: false,
    baby_complications: "",
  });
  const [originalFormData, setOriginalFormData] =
    useState<DeliverHistoryDetailList | null>(null);

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
          `/medical-record/get-delivery-record-data/${uuid}`,
        );
        const data = response.data;
        setData(data);

        const structuredData: DeliverHistoryDetailList = {
          delivery_date: formatDate(data?.delivery_date) || "",
          delivery_type: data?.delivery_type || "",
          deliver_complications: data?.deliver_complications || "",
          baby_gender: data?.baby_gender || "",
          vit_k_given: data?.vit_k_given || false,
          baby_weight: data?.baby_weight || "",
          hbo_given: data?.hbo_given || false,
          baby_length: data?.baby_length || "",
          apgar_score: data?.apgar_score || "",
          eye_ointment: data?.eye_ointment || false,
          imd: data?.imd || false,
          baby_complications: data?.baby_complications || "",
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
        `/medical-record/update-delivery-record-data/${uuid}`,
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
            Informasi Persalinan
          </h2>
        </div>

        <div className="flex-1 flex flex-col py-5 px-5 gap-6">
          <div className=" grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Tanggal Persalinan
              </span>
              <input
                name="delivery_date"
                value={formData.delivery_date}
                onChange={handleInputChange}
                type="date"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan tanggal persalinan"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Metode Persalinan
              </span>
              <select
                name="delivery_type"
                value={formData.delivery_type}
                onChange={handleInputChange}
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
              >
                <option value="" disabled hidden>
                  Pilih Metode Persalinan
                </option>

                <option value="normal">Normal</option>
                <option value="komplikasi">Komplikasi</option>
              </select>
           
            </label>
          </div>
          <div className="flex flex-col gap-5">
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Komplikasi Persalinan
              </span>
              <textarea
                name="delivery_complications"
                value={formData.deliver_complications || ""}
                onChange={handleInputChange}
                rows={3}
                className="mt-1 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan detail komplikasi persalinan"
              />
            </label>
          </div>
        </div>
        <div className="border-t border-[#E4E8E1]  ">
          <div className="border-b border-[#E4E8E1] px-5 py-4  ">
            <h2 className="text-[16px] font-bold text-[#4F6F52]">
              Informasi Bayi
            </h2>
          </div>
          <div className="flex-1 flex flex-col py-5 px-5 gap-6">
            <div className=" grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4   ">
              <label className="flex flex-col text-sm gap-2">
                <span className="text-[12px] font-bold text-[#2F3A2F]">
                  Jenis Kelamin Bayi
                </span>
                <select
                  name="baby_gender"
                  value={formData.baby_gender}
                  onChange={handleInputChange}
                  className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
                >
                  <option value="" disabled hidden>
                    Pilih Jenis Kelamin
                  </option>
                  <option value="perempuan">Perempuan</option>
                  <option value="laki-laki">Laki-laki</option>
                </select>
              </label>
              <label className="flex flex-col text-sm gap-2">
                <span className="text-[12px] font-bold text-[#2F3A2F]">
                  Berat Bayi (kg)
                </span>
                <input
                  name="baby_weight"
                  value={formData.baby_weight}
                  onChange={handleInputChange}
                  type="number"
                  className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                  placeholder="Masukkan berat bayi (kg)"
                />
              </label>
              <label className="flex flex-col text-sm gap-2">
                <span className="text-[12px] font-bold text-[#2F3A2F]">
                  Panjang Bayi (cm)
                </span>
                <input
                  name="baby_length"
                  value={formData.baby_length}
                  onChange={handleInputChange}
                  type="number"
                  className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                  placeholder="Masukkan panjang bayi (cm)"
                />
              </label>
              <label className="flex flex-col text-sm gap-2">
                <span className="text-[12px] font-bold text-[#2F3A2F]">
                  APGAR Score
                </span>
                <input
                  name="apgar_score"
                  value={formData.apgar_score}
                  onChange={handleInputChange}
                  type="text"
                  className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                  placeholder="Masukkan panjang bayi (cm)"
                />
              </label>
              <label className="flex flex-col text-sm gap-2">
                <span className="text-[12px] font-bold text-[#2F3A2F]">
                  Pemberian Vitamin K
                </span>
                <select
                  value={formData.vit_k_given ? "true" : "false"}
                  onChange={(e) => {
                    const boolValue = e.target.value === "true";
                    setFormData((prev) => ({
                      ...prev,
                      vit_k_given: boolValue,
                    }));
                  }}
                  className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
                >
                  <option value="" disabled hidden>
                    Pilih Status
                  </option>
                  <option value="true">Sudah</option>
                  <option value="false">Belum</option>
                </select>
              </label>
              <label className="flex flex-col text-sm gap-2">
                <span className="text-[12px] font-bold text-[#2F3A2F]">
                  Pemberian HB0
                </span>
                <select
                  value={formData.hbo_given ? "true" : "false"}
                  onChange={(e) => {
                    const boolValue = e.target.value === "true";
                    setFormData((prev) => ({
                      ...prev,
                      hbo_given: boolValue,
                    }));
                  }}
                  className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
                >
                  <option value="" disabled hidden>
                    Pilih Status
                  </option>
                  <option value="true">Sudah</option>
                  <option value="false">Belum</option>
                </select>
              </label>
              <label className="flex flex-col text-sm gap-2">
                <span className="text-[12px] font-bold text-[#2F3A2F]">
                  Pemberian Salep Mata
                </span>
                <select
                  value={formData.eye_ointment ? "true" : "false"}
                  onChange={(e) => {
                    const boolValue = e.target.value === "true";
                    setFormData((prev) => ({
                      ...prev,
                      eye_ointment: boolValue,
                    }));
                  }}
                  className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
                >
                  <option value="" disabled hidden>
                    Pilih Status
                  </option>
                  <option value="true">Sudah</option>
                  <option value="false">Belum</option>
                </select>
              </label>
              <label className="flex flex-col text-sm gap-2">
                <span className="text-[12px] font-bold text-[#2F3A2F]">
                  imd
                </span>
                <select
                  value={formData.imd ? "true" : "false"}
                  onChange={(e) => {
                    const boolValue = e.target.value === "true";
                    setFormData((prev) => ({
                      ...prev,
                      imd: boolValue,
                    }));
                  }}
                  className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
                >
                  <option value="" disabled hidden>
                    Pilih Status
                  </option>
                  <option value="true">Sudah</option>
                  <option value="false">Belum</option>
                </select>
              </label>
            </div>
            <div className="flex flex-col gap-5">
              <label className="flex flex-col text-sm gap-2">
                <span className="text-[12px] font-bold text-[#2F3A2F]">
                  Komplikasi Bayi
                </span>
                <textarea
                  name="delivery_complications"
                  value={formData.baby_complications || ""}
                  onChange={handleInputChange}
                  rows={3}
                  className="mt-1 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                  placeholder="Masukkan detail komplikasi persalinan"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-[#D2D8CF] px-5 py-4 sm:flex-row sm:items-center sm:justify-end mt-6 bg-white rounded-[14px] border shadow-sm">
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
export default DeliverHistoryDetail;
