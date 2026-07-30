"use client";
import React from "react";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/utils/app";
import Swal from "sweetalert2";

interface PatientInformationDetailList {
  patient_name?: string;
  nik: string;
  birthdate: string;
  gender: string;
  age: string;
  patient_number: string;
  address: string;
  type: string;
  education: string;
  occupation: string;
  bpjs_number: string;
  primary_healthcare: string;
  family_name: string;
  family_nik: string;
  family_birthdate: string;
  family_gender: string;
  family_age: string;
  family_number: string;
  family_address: string;
  family_education: string;
  family_occupation: string;
  relation: string;
}

const FamilyInformation = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [patientName, setPatientName] = useState("-");

  const [formData, setFormData] = useState<PatientInformationDetailList>({
    patient_name: "",
    nik: "",
    birthdate: "",
    gender: "",
    age: "",
    patient_number: "",
    address: "",
    type: "",
    education: "",
    occupation: "",
    bpjs_number: "",
    primary_healthcare: "",
    family_name: "",
    family_nik: "",
    family_birthdate: "",
    family_gender: "",
    family_age: "",
    family_number: "",
    family_address: "",
    family_education: "",
    family_occupation: "",
    relation: "",
  });

  const [originalFormData, setOriginalFormData] =
    useState<PatientInformationDetailList | null>(null);

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
    const fetchAllMedicalData = async () => {
      if (!uuid) return;
      try {
        setLoading(true);

        const [patientResponse, familyResponse] = await Promise.all([
          api.get(`/medical-record/get-patient-data/${uuid}`),
          api.get(`/medical-record/get-family-data/${uuid}`),
        ]);

        const pData = patientResponse.data;
        const fData = familyResponse.data;
        if (patientResponse.data.patient_name) {
          setPatientName(patientResponse.data.patient_name);
        } else if (patientResponse.data.patient?.patient_name) {
          setPatientName(patientResponse.data.patient.patient_name);
        }
        const initialFormValues: PatientInformationDetailList = {
          nik: pData?.nik || "",
          patient_name: pData?.patient_name || "",
          birthdate: formatDate(pData?.birthdate),
          gender: pData?.gender || "",
          age: pData?.age || "",
          patient_number: pData?.patient_number || "",
          address: pData?.address || "",
          type: pData?.type || "",
          education: pData?.education || "",
          occupation: pData?.occupation || "",
          bpjs_number: pData?.bpjs_number || "",
          primary_healthcare: pData?.primary_healthcare || "",

          family_name: fData?.patient_name || fData?.family_name || "",
          family_nik: fData?.nik || fData?.family_nik || "",
          family_birthdate: formatDate(
            fData?.birthdate || fData?.family_birthdate,
          ),
          family_gender: fData?.gender || fData?.family_gender || "",
          family_age: fData?.age || fData?.family_age || "",
          family_number: fData?.patient_number || fData?.family_number || "",
          family_address: fData?.address || fData?.family_address || "",
          family_education: fData?.education || fData?.family_education || "",
          family_occupation:
            fData?.occupation || fData?.family_occupation || "",
          relation: fData?.relation || "",
        };

        setFormData(initialFormValues);
        setOriginalFormData(initialFormValues);
      } catch (err: any) {
        setError(
          err.response?.data?.msg ||
          err.message ||
          "Terjadi kesalahan pengambilan data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAllMedicalData();
  }, [uuid]);

  const handleDelete = async () => {
    if (!uuid) return;
    try {
      setIsDeleting(true);
      setError("");
      const response = await api.delete(
        `/medical-record/delete-record/${uuid}`,
      );

      if (response.status === 200 || response.status === 204) {
        setShowDeleteConfirm(false);

        await Swal.fire({
          title: "Berhasil Dihapus",
          text: "Data kunjungan pasien telah dihapus dari sistem.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });

        router.push("/medical-record");
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
        `/medical-record/update-patient-data/${uuid}`,
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
            Informasi Pasien
          </h2>
        </div>

        <div className="flex-1 flex flex-col py-5 px-5 gap-6">
          <div className=" grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Nama Pasien
              </span>
              <input
                name="patient_name"
                value={formData.patient_name}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan nama pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Tanggal Lahir
              </span>
              <input
                name="birthdate"
                value={formData.birthdate}
                onChange={handleInputChange}
                type="date"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan nama pasien"
              />
            </label>

            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">Umur</span>
              <input
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                type="text"
                disabled
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan umur pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">NIK</span>
              <input
                name="nik"
                value={formData.nik}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan NIK pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                No Telepon
              </span>
              <input
                name="patient_number"
                value={formData.patient_number}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan nomor telepon"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Alamat
              </span>
              <input
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan alamat pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Tipe Pasien
              </span>
              <input
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                type="text"
                disabled
                className="mt-2 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Masukkan nomor telepon pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Jenis Kelamin
              </span>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
              >
                <option value="" disabled hidden>
                  Pilih Jenis Kelamin
                </option>
                <option value="perempuan">Perempuan</option>
                <option value="laki-laki">Laki-Laki</option>
              </select>
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Pendidikan
              </span>
              <input
                name="education"
                value={formData.education}
                onChange={handleInputChange}
                type="text"
                className="mt-2 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Masukkan pendidikan pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Pekerjaan
              </span>
              <input
                name="occupation"
                value={formData.occupation}
                onChange={handleInputChange}
                type="text"
                className="mt-2 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Masukkan pekerjaan pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Nomor BPJS
              </span>
              <input
                name="bpjs_number"
                value={formData.bpjs_number}
                onChange={handleInputChange}
                type="text"
                className="mt-2 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Masukkan nomor telepon pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Faskes Tingkat Pertama{" "}
              </span>
              <input
                name="primary_healthcare"
                value={formData.primary_healthcare}
                onChange={handleInputChange}
                type="text"
                className="mt-2 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Masukkan fasilitas kesehatan ke satu"
              />
            </label>
          </div>
        </div>
        <div className="border-t border-[#E4E8E1]  ">
          <div className="border-b border-[#E4E8E1] px-5 py-4  ">
            <h2 className="text-[16px] font-bold text-[#4F6F52]">
              Informasi Keluarga
            </h2>
          </div>

          <div className=" grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4  px-5 py-4 ">
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Nama Keluarga
              </span>
              <input
                name="family_name"
                value={formData.family_name}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan nama keluarga"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Tanggal Lahir Keluarga
              </span>
              <input
                name="family_birthdate"
                value={formData.family_birthdate}
                onChange={handleInputChange}
                type="date"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan tanggal lahir keluarga"
              />
            </label>

            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Umur Keluarga
              </span>
              <input
                name="family_age"
                value={formData.family_age}
                onChange={handleInputChange}
                type="text"
                disabled
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan umur pasien"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                NIK Keluarga
              </span>
              <input
                name="family_nik"
                value={formData.family_nik}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan NIK keluarga"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                No Telepon Keluarga
              </span>
              <input
                name="family_number"
                value={formData.family_number}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan nomor telepon keluarga"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Alamat Keluarga
              </span>
              <input
                name="family_address"
                value={formData.family_address}
                onChange={handleInputChange}
                type="text"
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10"
                placeholder="Masukkan alamat keluarga"
              />
            </label>

            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Hubungan
              </span>
              <input
                name="relation"
                value={formData.relation}
                onChange={handleInputChange}
                type="text"
                className="mt-2 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Masukkan hubungan keluarga"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Jenis Kelamin Keluarga
              </span>
              <select
                name="family_gender"
                value={formData.family_gender}
                onChange={handleInputChange}
                className="mt-1 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 cursor-pointer"
              >
                <option value="" disabled hidden>
                  Pilih Jenis Kelamin
                </option>
                <option value="perempuan">Perempuan</option>
                <option value="laki-laki">Pria</option>
              </select>
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Pendidikan Keluarga
              </span>
              <input
                name="family_education"
                value={formData.family_education}
                onChange={handleInputChange}
                type="text"
                className="mt-2 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Masukkan pendidikan keluarga"
              />
            </label>
            <label className="flex flex-col text-sm gap-2">
              <span className="text-[12px] font-bold text-[#2F3A2F]">
                Pekerjaan Keluarga
              </span>
              <input
                name="family_occupation"
                value={formData.family_occupation}
                onChange={handleInputChange}
                type="text"
                className="mt-2 h-10.5 w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Masukkan pekerjaan keluarga"
              />
            </label>
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t  px-5 py-4 sm:flex-row sm:items-center sm:justify-between mt-6 bg-white rounded-[14px] border border-[#D2D8CF] shadow-sm">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isSaving || isDeleting}
          className="h-9.5 rounded-[30px] border border-red-200 bg-white px-5 text-[12px] font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hapus Rekam Medis
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[420px] rounded-2xl bg-white px-6 py-6 shadow-xl">
            <h2 className="text-[20px] font-bold text-[#2F3A2F]">
              Hapus Rekam Medis?
            </h2>

            <p className="mt-3 text-[13px] leading-relaxed text-[#4B4B4B]">
              Rekam medis dengan nama pasien{" "}
              <span className="font-bold">{patientName}</span> akan dihapus dari
              penyimpanan. Aksi ini tidak bisa dibatalkan.
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
export default FamilyInformation;
