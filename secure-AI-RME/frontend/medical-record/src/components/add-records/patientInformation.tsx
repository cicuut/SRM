"use client";
import React from "react";
import { useSearchParams } from "next/navigation";

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
        const birth = new Date(value);
        const today = new Date();
        let year = today.getFullYear() - birth.getFullYear();
        let month = today.getMonth() - birth.getMonth();

        if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
          year--;
        }

        updatedData.age = year >= 0 ? `${year} years old` : "Invalid Date";
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
            className="p-2 p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
          <label className="block">
            <p  className="text-md font-medium text-gray-700 md:text-sm">
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
            <p  className="text-md font-medium text-gray-700 md:text-sm">Umur</p>
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
            <p  className="text-md font-medium text-gray-700 md:text-sm">
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
              <option value="perempuan">Wanita</option>
              <option value="laki-laki">Pria</option>
            </select>
          </label>
          <label className="block">
            {" "}
            <p  className="text-md font-medium text-gray-700 md:text-sm">
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
          <p  className="text-md font-medium text-gray-700 md:text-sm">
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
          <p  className="text-md font-medium text-gray-700 md:text-sm">
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
          <p  className="text-md font-medium text-gray-700 md:text-sm">
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
          <p  className="text-md font-medium text-gray-700 md:text-sm">
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
          <p  className="text-md font-medium text-gray-700 md:text-sm">
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
          <p  className="text-md font-medium text-gray-700 md:text-sm">
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
