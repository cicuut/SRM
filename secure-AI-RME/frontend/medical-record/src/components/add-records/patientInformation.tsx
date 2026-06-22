"use client";
import React from "react";
import { useSearchParams } from "next/navigation";
import api from "@/utils/app";
import Swal from "sweetalert2";

interface PatientInformationProps {
  patient_name?: string;
  national_id?: string;
  birth_date?: string;
  gender?: string;
  address?: string;
  patient_number?: string;
  education_level?: string;
  occupation?: string;
  age?: string;
  insurance_number?: string;
  primary_health_facility?: string;
  record_type?: string;
  onDataChange: (data: any) => void;
  onFamilyAutoFill?: (familyData: any) => void;
}

const PatientInformation = (props: PatientInformationProps) => {
  const searchParams = useSearchParams();
  const recordType = searchParams.get("type");

  const [formData, setFormData] = React.useState({
    patient_name: props.patient_name || "",
    national_id: props.national_id || "",
    birth_date: props.birth_date || "",
    age: props.age || "",
    gender: props.gender || "",
    address: props.address || "",
    patient_number: props.patient_number || "",
    education_level: props.education_level || "",
    occupation: props.occupation || "",
    insurance_number: props.insurance_number || "",
    primary_health_facility: props.primary_health_facility || "",
    record_type: props.record_type || recordType || "",
  });

  const handleNikCheck = async (nik: string) => {
    const cleanNik = nik.trim();
    if (cleanNik.length !== 16) return;

    try {
      const response = await api.get(`medical-record/check-nik/${cleanNik}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });

      const result = response.data;

      if (result && result.exists) {
        await Swal.fire({
          title: "Warning",
          text: result.msg,
          icon: "warning",
          confirmButtonColor: "#739072",
        });
        setFormData((prev) => ({
          ...prev,
          patient_name: result.patient_data.patient_name || "",
          birth_date: result.patient_data.birth_date || "",
          gender: result.patient_data.gender || "perempuan",
          address: result.patient_data.address || "",
          patient_number: result.patient_data.patient_number || "",
          education_level: result.patient_data.education_level || "",
          occupation: result.patient_data.occupation || "",
          insurance_number: result.patient_data.insurance_number || "",
          primary_health_facility:
            result.patient_data.primary_health_facility || "",
          age: result.patient_data.birth_date
            ? calculateAge(result.patient_data.birth_date)
            : "",
        }));

        if (props.onFamilyAutoFill && result.family_data) {
          props.onFamilyAutoFill(result.family_data);
        }
      }
    } catch (error) {
      console.error("Gagal memuat auto-fill data pasien:", error);
    }
  };
  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return "";

    const birth = new Date(birthDateStr);
    const today = new Date();

    let year = today.getFullYear() - birth.getFullYear();
    let month = today.getMonth() - birth.getMonth();
    let day = today.getDate() - birth.getDate();

    if (day < 0) {
      month--;
    }

    if (month < 0) {
      year--;
      month += 12;
    }

    if (year < 0) {
      return "Invalid Date";
    }

    return `${year} tahun ${month} bulan`;
  };
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => {
      const updatedData = {
        ...prevData,
        [name]: value,
      };

      if (name === "birth_date" && value) {
        updatedData.age = calculateAge(value);
      } else if (name === "birth_date" && !value) {
        updatedData.age = "";
      }

      return updatedData;
    });
  };

  React.useEffect(() => {
    props.onDataChange(formData);
  }, [formData, props]);
  return (
    <>
      <div className="flex flex-col gap-0">
        <h2 className="text-md text-[#4F6F52] mt-5 underline leading-none">
          Identitas Pasien
        </h2>
        <hr className="mt-0"></hr>
      </div>
      <div className="grid grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-2">
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Nama Lengkap <span className="text-red-500">*</span>
          </p>
          <input
            type="text"
            name="patient_name"
            id="name"
            value={formData.patient_name}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            NIK<span className="text-red-500">*</span>
          </p>
          <input
            type="text"
            name="national_id"
            id="nik"
            placeholder="Masukan - jika tidak ada"
            required
            value={formData.national_id}
            onChange={handleInputChange}
            onBlur={(e) => handleNikCheck(e.target.value)}
            className="p-2 p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Tanggal Lahir<span className="text-red-500">*</span>
            </p>
            <input
              type="date"
              name="birth_date"
              id="birth_date"
              value={formData.birth_date}
              onChange={handleInputChange}
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
          <label className="block">
            {" "}
            <p className="text-md font-medium text-gray-700 md:text-sm">Umur</p>
            <input
              type="text"
              name="age"
              id="age"
              value={formData.age}
              disabled
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
          <label className="block">
            {" "}
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Jenis Kelamin<span className="text-red-500">*</span>
            </p>
            <select
              name="gender"
              id="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            >
              <option value="" disabled>
                Pilih Jenis Kelamin
              </option>
              <option value="perempuan">Perempuan</option>
              <option value="laki-laki">Laki-Laki</option>
            </select>
          </label>
          <label className="block">
            {" "}
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Tipe Rekam Medis
            </p>
            <input
              type="text"
              name="record_type"
              id="type"
              value={formData.record_type}
              disabled
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
        </div>
        <label className="block">
          {" "}
          <p className="text-md font-medium text-gray-700 md:text-sm">
            {" "}
            No. Telepon <span className="text-red-500">*</span>
          </p>
          <input
            type="text"
            name="patient_number"
            placeholder="Masukan - jika tidak ada"
            required
            id="phone"
            value={formData.patient_number}
            onChange={handleInputChange}
            className="p-2 p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Alamat<span className="text-red-500">*</span>
          </p>
          <textarea
            name="address"
            id="address"
            value={formData.address}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Pendidikan<span className="text-red-500">*</span>
          </p>
          <input
            type="text"
            name="education_level"
            id="education"
            value={formData.education_level}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Pekerjaan<span className="text-red-500">*</span>
          </p>
          <input
            type="text"
            name="occupation"
            id="occupation"
            value={formData.occupation}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Nomor BPJS
          </p>
          <input
            type="text"
            name="insurance_number"
            id="bpjs"
            value={formData.insurance_number}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Faskes Tingkat 1
          </p>
          <input
            type="text"
            name="primary_health_facility"
            id="faskes"
            value={formData.primary_health_facility}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
      </div>
    </>
  );
};
export default PatientInformation;
