"use client";
import React from "react";
import { useState, useEffect, useMemo } from "react";
import { emit } from "process";
import Cookies from "js-cookie";
import { useParams, useRouter } from "next/navigation";
import api from "@/utils/app";
import Swal from "sweetalert2";
import { Plus, X } from "lucide-react";

interface CurrentPregnancyList {
  current_pregnancy: {
    pre_preg_weight_kg?: string;
    pre_preg_muac_cm?: string;
    contraceptive_history: string;
    family_med_history: string;
    registration_date?: string;
    tt_screening?: string;
    height_cm?: string;
    weight_kg?: string;
    lab_results?: string;
    muac_cm?: string;
    last_menstrual_period?: string;
    expected_due_date?: string;
    diagnosis?: string;
  };
  past_obstetric_history: PastObstetricHistoryDetailList[];
}

interface PastObstetricHistoryDetailList {
  pregnancy_no?: string;
  gestational_age?: string;
  pregnancy_complications?: string;
  delivery_mode?: string;
  delivery_complications?: string;
  baby_weight?: string;
  baby_height?: string;
  baby_complications?: string;
  postpartum_status?: string;
  postpartum_complications?: string;
}

const PastObstecticHistoryDetail = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;
  const [data, setData] = useState<CurrentPregnancyList | null>(null);
  const router = useRouter();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<CurrentPregnancyList>({
    current_pregnancy: {
      pre_preg_weight_kg: "",
      pre_preg_muac_cm: "",
      contraceptive_history: "",
      family_med_history: "",
      registration_date: "",
      tt_screening: "",
      height_cm: "",
      weight_kg: "",
      lab_results: "",
      muac_cm: "",
      last_menstrual_period: "",
      expected_due_date: "",
      diagnosis: "",
    },
    past_obstetric_history: [
      {
        pregnancy_no: "",
        gestational_age: "",
        pregnancy_complications: "",
        delivery_mode: "",
        delivery_complications: "",
        baby_weight: "",
        baby_height: "",
        baby_complications: "",
        postpartum_status: "",
        postpartum_complications: "",
      },
    ],
  });

  const [originalFormData, setOriginalFormData] =
    useState<CurrentPregnancyList | null>(null);

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
      setLoading(true);
      try {
        const response = await api.get(
          `/medical-record/get-pregnancy-record-data/${uuid}`,
        );
        const data = response.data;
        setData(data);
        const structuredData: CurrentPregnancyList = {
          current_pregnancy: {
            pre_preg_weight_kg:
              data?.current_pregnancy?.pre_preg_weight_kg || "",
            pre_preg_muac_cm: data?.current_pregnancy?.pre_preg_muac_cm || "",
            contraceptive_history:
              data?.current_pregnancy?.contraceptive_history || "",
            family_med_history:
              data?.current_pregnancy?.family_med_history || "",
            registration_date: formatDate(
              data?.current_pregnancy?.registration_date,
            ),
            tt_screening: formatDate(data?.current_pregnancy?.tt_screening),
            height_cm: data?.current_pregnancy?.height_cm || "",
            weight_kg: data?.current_pregnancy?.weight_kg || "",
            lab_results: data?.current_pregnancy?.lab_results || "",
            muac_cm: data?.current_pregnancy?.muac_cm || "",
            last_menstrual_period: formatDate(
              data?.current_pregnancy?.last_menstrual_period,
            ),
            expected_due_date: formatDate(
              data?.current_pregnancy?.expected_due_date,
            ),
            diagnosis: data?.current_pregnancy?.diagnosis || "",
          },
          past_obstetric_history: (data?.past_obstetric_history || []).map(
            (item: any) => ({
              pregnancy_no: item?.pregnancy_no || "",
              gestational_age: item?.gestational_age || "",
              pregnancy_complications: item?.pregnancy_complications || "",
              delivery_mode: item?.delivery_mode || "",
              delivery_complications: item?.delivery_complications || "",
              baby_weight: item?.baby_weight || "",
              baby_height: item?.baby_height || "",
              baby_complications: item?.baby_complications || "",
              postpartum_status: item?.postpartum_status || "",
              postpartum_complications: item?.postpartum_complications || "",
            }),
          ),
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

    setFormData((prev) => ({
      ...prev,
      current_pregnancy: {
        ...prev.current_pregnancy,
        [name]: value,
      },
    }));
  };

  const handlePastHistoryChange = (
    index: number,
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updatedHistory = [...prev.past_obstetric_history];

      updatedHistory[index] = {
        ...updatedHistory[index],
        [name]: value,
      };

      return {
        ...prev,
        past_obstetric_history: updatedHistory,
      };
    });
  };
  const handleAddPastHistory = () => {
    setFormData((prev) => ({
      ...prev,
      past_obstetric_history: [
        ...prev.past_obstetric_history,
        {
          pregnancy_no: (prev.past_obstetric_history.length + 1).toString(),
          gestational_age: "",
          pregnancy_complications: "",
          delivery_mode: "",
          delivery_complications: "",
          baby_weight: "",
          baby_height: "",
          baby_complications: "",
          postpartum_status: "",
          postpartum_complications: "",
        },
      ],
    }));
  };
  const handleCancelChanges = () => {
    if (originalFormData) {
      setFormData(originalFormData);
    }
  };
  const handleRemovePastHistory = (indexToRemove: number) => {
    setFormData((prev) => {
      const filteredHistory = prev.past_obstetric_history.filter(
        (_, index) => index !== indexToRemove,
      );

      const updatedHistory = filteredHistory.map((item, idx) => ({
        ...item,
        pregnancy_no: (idx + 1).toString(),
      }));

      return {
        ...prev,
        past_obstetric_history: updatedHistory,
      };
    });
  };
  const handleSaveAll = async () => {
    if (!uuid) return;
    try {
      setIsSaving(true);
      const response = await api.put(
        `/medical-record/update-pregnancy-record-data/${uuid}`,
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
            Informasi Kehamilan Saat Ini
          </h2>
        </div>

        <div className="flex-1 flex flex-col py-5 px-5 gap-6">
          <div className=" grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Tanggal Registrasi Kehamilan
              </span>
              <input
                name="registration_date"
                value={formData.current_pregnancy.registration_date}
                onChange={handleInputChange}
                type="date"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan tanggal registrasi"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Tinggi Badan (cm)
              </span>
              <input
                name="height_cm"
                value={formData.current_pregnancy.height_cm}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan tinggi badan"
              />
            </label>

            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Berat Badan (kg)
              </span>
              <input
                name="weight_kg"
                value={formData.current_pregnancy.weight_kg}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan berat badan"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Lingkar Lengan Atas (cm)
              </span>
              <input
                name="muac_cm"
                value={formData.current_pregnancy.muac_cm}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan lingkar lengan atas"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Hari Pertama Haid Terakhir
              </span>
              <input
                name="last_menstrual_period"
                value={formData.current_pregnancy.last_menstrual_period}
                onChange={handleInputChange}
                type="date"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan tanggal"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Tanggal Estimasi Persalinan
              </span>
              <input
                name="expected_due_date"
                value={formData.current_pregnancy.expected_due_date}
                onChange={handleInputChange}
                readOnly
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan tanggal"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                TT Screening
              </span>

              <select
                name="tt_screening"
                value={formData.current_pregnancy.tt_screening}
                onChange={handleInputChange}
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
              >
                <option value="" disabled hidden>
                  Pilih TT Screening
                </option>
                <option value="TT 0"> TT 0</option>
                <option value="TT 1"> TT 1</option>
                <option value="TT 2"> TT 2</option>
                <option value="TT 3"> TT 3</option>
                <option value="TT 4"> TT 4</option>
                <option value="TT 5"> TT 5</option>
              </select>
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Berat Badan Sebelum Hamil (kg)
              </span>
              <input
                name="pre_preg_weight_kg"
                value={formData.current_pregnancy.pre_preg_weight_kg}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan berat badan"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Lingkar Lengan Atas Sebelum Hamil (cm)
              </span>
              <input
                name="pre_preg_muac_cm"
                value={formData.current_pregnancy.pre_preg_muac_cm}
                onChange={handleInputChange}
                type="number"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan lingkar lengan atas"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Riwayat Kontrasepsi
              </span>

              <select
                name="contraceptive_history"
                value={formData.current_pregnancy.contraceptive_history}
                onChange={handleInputChange}
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
              >
                <option value="" disabled hidden>
                  Pilih Riwayat Kontrasepsi
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
                Riwayat Penyakit Keluarga
              </span>
              <input
                name="family_med_history"
                value={formData.current_pregnancy.family_med_history}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan riwayat penyakit keluarga"
              />
            </label>
          </div>
          <label className="flex flex-col text-sm gap-2">
            <span className="text-[12px] font-bold text-[#2F3A2F]">
              Hasil Lab
            </span>
            <textarea
              name="lab_results"
              value={formData.current_pregnancy.lab_results}
              onChange={handleInputChange}
              rows={3}
              className="mt-1 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
              placeholder="Masukkan detail hasil lab"
            />
          </label>
          <label className="flex flex-col text-sm gap-2">
            <span className="text-[12px] font-bold text-[#2F3A2F]">
              Diagnosis
            </span>
            <textarea
              name="diagnosis"
              value={formData.current_pregnancy.diagnosis}
              onChange={handleInputChange}
              rows={3}
              className="mt-1 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
              placeholder="Masukkan detail diagnosis"
            />
          </label>
        </div>
        <div className="border-t border-[#E4E8E1]  ">
          <div className="border-b border-[#E4E8E1] px-5 py-4  flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#4F6F52]">
              Informasi Kehamilan Sebelumnya
            </h2>
            <button onClick={handleAddPastHistory}>
              <span>
                <Plus className="text-[#4F6F52] hover:scale-110 transition-transform cursor-pointer" />{" "}
              </span>
            </button>
          </div>
          {formData?.past_obstetric_history &&
          formData.past_obstetric_history.length > 0 ? (
            <div className="pb-5 px-5">
              {formData.past_obstetric_history.map((item, index) => (
                <div key={index} className="mt-5">
                  <div className="flex items-center justify-between border-b border-dashed border-[#D2D8CF] pb-2 mb-4">
                    <h3 className="font-bold text-[#739072]">
                      Kehamilan Ke-{item.pregnancy_no || index + 1}
                    </h3>

                  
                    <button
                      type="button"
                      onClick={() => handleRemovePastHistory(index)} // 🌟 Panggil fungsi hapus dengan melempar indeksnya
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all cursor-pointer flex items-center justify-center group"
                      title="Hapus baris ini"
                    >
                      <X
                        size={16}
                        className="group-hover:scale-110 transition-transform"
                      />
                    </button>
                  </div>
                  <div className=" grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <label className="flex flex-col text-sm gap-2">
                      <span className="text-[12px] font-bold text-[#2F3A2F]">
                        Usia Kehamilan (minggu)
                      </span>
                      <input
                        name="gestational_age"
                        value={item?.gestational_age || ""}
                        onChange={(e) => handlePastHistoryChange(index, e)}
                        type="text"
                        className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                        placeholder="Masukkan usia kehamilan"
                      />
                    </label>
                    <label className="flex flex-col text-sm gap-2">
                      <span className="text-[12px] font-bold text-[#2F3A2F]">
                        Cara Persalinan
                      </span>
                      <select
                        name="delivery_mode"
                        value={item?.delivery_mode || ""}
                        onChange={(e) => handlePastHistoryChange(index, e)}
                        className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
                      >
                        <option value="" disabled hidden>
                          Pilih Cara Persalinan
                        </option>
                        <option value="spontan">Spontan</option>
                        <option value="normal">Normal</option>
                        <option value="sc">SC</option>
                      </select>
                    </label>
                    <label className="flex flex-col text-sm gap-2">
                      <span className="text-[12px] font-bold text-[#2F3A2F]">
                        Berat Badan Bayi (kg)
                      </span>
                      <input
                        name="baby_weight"
                        value={item?.baby_weight || ""}
                        onChange={(e) => handlePastHistoryChange(index, e)}
                        type="text"
                        className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                        placeholder="Masukkan berat badan bayi"
                      />
                    </label>
                    <label className="flex flex-col text-sm gap-2">
                      <span className="text-[12px] font-bold text-[#2F3A2F]">
                        Panjang Badan Bayi (cm)
                      </span>
                      <input
                        name="baby_height"
                        value={item?.baby_height || ""}
                        onChange={(e) => handlePastHistoryChange(index, e)}
                        type="text"
                        className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                        placeholder="Masukkan panjang badan bayi"
                      />
                    </label>
                    <label className="flex flex-col text-sm gap-2">
                      <span className="text-[12px] font-bold text-[#2F3A2F]">
                        Masa Nifas
                      </span>

                      <select
                        name="postpartum_status"
                        value={item?.postpartum_status || ""}
                        onChange={(e) => handlePastHistoryChange(index, e)}
                        className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
                      >
                        <option value="" disabled hidden>
                          Pilih Masa Nifas
                        </option>
                        <option value="normal">Normal</option>
                        <option value="komplikasi">Komplikasi</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-col gap-5 mt-5">
                    <label className="flex flex-col text-sm gap-2">
                      <span className="text-[12px] font-bold text-[#2F3A2F]">
                        Komplikasi Kehamilan
                      </span>
                      <textarea
                        name="pregnancy_complications"
                        value={item?.pregnancy_complications || ""}
                        onChange={(e) => handlePastHistoryChange(index, e)}
                        rows={3}
                        className="mt-1 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                        placeholder="Masukkan detail komplikasi kehamilan"
                      />
                    </label>
                    <label className="flex flex-col text-sm gap-2">
                      <span className="text-[12px] font-bold text-[#2F3A2F]">
                        Komplikasi Persalinan
                      </span>
                      <textarea
                        name="delivery_complications"
                        value={item?.delivery_complications || ""}
                        onChange={(e) => handlePastHistoryChange(index, e)}
                        rows={3}
                        className="mt-1 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                        placeholder="Masukkan detail komplikasi persalinan"
                      />
                    </label>
                    <label className="flex flex-col text-sm gap-2">
                      <span className="text-[12px] font-bold text-[#2F3A2F]">
                        Komplikasi Bayi{" "}
                      </span>
                      <textarea
                        name="baby_complications"
                        value={item?.baby_complications || ""}
                        onChange={(e) => handlePastHistoryChange(index, e)}
                        rows={3}
                        className="mt-1 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                        placeholder="Masukkan detail komplikasi bayi"
                      />
                    </label>
                    <label className="flex flex-col text-sm gap-2">
                      <span className="text-[12px] font-bold text-[#2F3A2F]">
                        Komplikasi Nifas
                      </span>
                      <textarea
                        name="postpartum_complications"
                        value={item?.postpartum_complications || ""}
                        onChange={(e) => handlePastHistoryChange(index, e)}
                        rows={3}
                        className="mt-1 w-full resize-y rounded-[10px] border border-[#D2D8CF] bg-white px-3 py-3 text-[13px] leading-relaxed text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                        placeholder="Masukkan detail komplikasi nifas"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
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
export default PastObstecticHistoryDetail;
