"use client";
import React from "react";
import { useSearchParams } from "next/navigation";

interface FamilyInformationProps {
  family_name?: string;
  family_national_id?: string;
  family_birth_date?: string;
  family_gender?: string;
  family_address?: string;
  family_family_number?: string;
  family_education_level?: string;
  family_occupation?: string;
  family_age?: string;
  relation?: string;
  onDataChange: (data: any) => void;
  autoFillData?: any;
}

const FamilyInformation = (props: FamilyInformationProps) => {
  const searchParams = useSearchParams();
  const recordType = searchParams.get("type");

  const [formData, setFormData] = React.useState({
    family_name: props.family_name || "",
    family_national_id: props.family_national_id || "",
    family_birth_date: props.family_birth_date || "",
    family_age: props.family_age || "",
    family_gender: props.family_gender || "",
    family_address: props.family_address || "",
    family_number: props.family_family_number || "",
    family_education_level: props.family_education_level || "",
    family_occupation: props.family_occupation || "",
    relation: props.relation || "",
  });

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

  React.useEffect(() => {
    if (props.autoFillData) {
      setFormData((prevData) => ({
        ...prevData,
        family_name: props.autoFillData.family_name || "",
        family_national_id: props.autoFillData.family_nik || "",
        family_birth_date: props.autoFillData.family_birthdate || "",
        family_gender: props.autoFillData.family_gender || "",
        relation: props.autoFillData.relation || "",
        family_address: props.autoFillData.family_address || "",
        family_number: props.autoFillData.family_number || "",
        family_education_level: props.autoFillData.family_education || "",
        family_occupation: props.autoFillData.family_occupation || "",
        family_age: props.autoFillData.family_birthdate
          ? calculateAge(props.autoFillData.family_birthdate)
          : "",
      }));
    }
  }, [props.autoFillData]);

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

      if (name === "family_birth_date" && value) {
        updatedData.family_age = calculateAge(value);
      } else if (name === "birth_date" && !value) {
        updatedData.family_age = "";
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
        <h2 className="text-md text-[#4F6F52]  underline leading-none !font-lexend">
          Identitas Keluarga
        </h2>
        <hr className="mt-0"></hr>
      </div>
      <div className="grid grid-cols-1 gap-4 px-3 pb-5 md:grid-cols-2">
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            {" "}
            Nama Lengkap <span className="text-red-500">*</span>
          </p>
          <input
            type="text"
            name="family_name"
            id="family_name"
            value={formData.family_name}
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
            name="family_national_id"
            required
            placeholder="Masukan - jika tidak ada"
            id="family_national_id"
            value={formData.family_national_id}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Tanggal Lahir<span className="text-red-500">*</span>
            </p>
            <input
              type="date"
              name="family_birth_date"
              id="family_birth_date"
              value={formData.family_birth_date}
              onChange={handleInputChange}
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>

          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">Umur</p>
            <input
              type="text"
              name="family_age"
              id="family_age"
              value={formData.family_age}
              disabled
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>

          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Jenis Kelamin<span className="text-red-500">*</span>
            </p>
            <select
              name="family_gender"
              id="family_gender"
              value={formData.family_gender}
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
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Hubungan<span className="text-red-500">*</span>
            </p>
            <input
              type="text"
              name="relation"
              id="relation"
              value={formData.relation}
              onChange={handleInputChange}
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
        </div>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            No. Telepon<span className="text-red-500">*</span>
          </p>
          <input
            type="text"
            name="family_number"
            id="family_number"
            required
            placeholder="Masukan - jika tidak ada"
            value={formData.family_number}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Alamat<span className="text-red-500">*</span>
          </p>
          <textarea
            name="family_address"
            id="family_address"
            value={formData.family_address}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Pendidikan
          </p>
          <input
            type="text"
            name="family_education_level"
            id="education"
            value={formData.family_education_level}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Pekerjaan
          </p>
          <input
            type="text"
            name="family_occupation"
            id="family_occupation"
            value={formData.family_occupation}
            onChange={handleInputChange}
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
      </div>
    </>
  );
};
export default FamilyInformation;
