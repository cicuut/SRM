'use client'
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prevData) => {
            const updatedData = {
                ...prevData,
                [name]: value,
            };


            if (name === "family_birth_date" && value) {
                const birth = new Date(value);
                const today = new Date();
                let year = today.getFullYear() - birth.getFullYear();
                let month = today.getMonth() - birth.getMonth();

                if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
                    year--;
                }


                updatedData.family_age = year >= 0 ? `${year} years old` : "Invalid Date";
            } else if (name === "family_birth_date" && !value) {
                updatedData.family_age = "";
            }

            return updatedData;
        });


    };

    React.useEffect(() => {
        props.onDataChange(formData);
    }, [formData, props]);
    return (
        <><div className="flex flex-col gap-0">
            <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none !font-lexend">Identitas Keluarga</h2>
            <hr className="mt-0"></hr>
        </div><div className="flex flex-col mt-4 gap-y-4">
                <div className="flex flex-row w-full gap-20 justify-between">
                    <div className="flex flex-col flex-1 gap-y-1 ">
                        Nama Lengkap
                        <input type="text" name="family_name" id="family_name" value={formData.family_name} onChange={handleInputChange} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                    <div className="flex flex-col  flex-1">
                        NIK
                        <input type="text" name="family_national_id" id="family_national_id" value={formData.family_national_id} onChange={handleInputChange} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                </div>
                <div className="flex flex-row w-full gap-20 justify-between">
                    <div>
                        Tanggal Lahir
                        <input type="date" name="family_birth_date" id="family_birth_date" value={formData.family_birth_date} onChange={handleInputChange} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                    <div>
                        Umur
                        <input type="text" name="family_age" id="family_age" value={formData.family_age} disabled className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                    <div>
                        Jenis Kelamin
                        <select name="family_gender" id="family_gender" value={formData.family_gender} onChange={handleInputChange} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                            <option value="" disabled>Pilih Jenis Kelamanin</option>
                            <option value="perempuan">Wanita</option>
                            <option value="laki-laki">Pria</option>
                        </select>
                    </div>
                    <div>
                        Hubungan
                        <input type="text" name="relation" id="relation" value={formData.relation} onChange={handleInputChange} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                </div>
                <div className="flex flex-row w-full gap-20 justify-start">
                    <div className="flex flex-col flex-1 gap-y-1">
                        No. Telepon
                        <input type="text" name="family_number" id="family_number" value={formData.family_number} onChange={handleInputChange} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                    <div className="flex flex-col flex-1 gap-y-1 ">
                        Alamat
                        <textarea name="family_address" id="family_address" value={formData.family_address} onChange={handleInputChange} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                </div>
                <div className="flex flex-row w-full gap-20 justify-between">
                    <div className="flex flex-col flex-1 gap-y-1 ">
                        Pendidikan
                        <input type="text" name="family_education_level" id="education" value={formData.family_education_level} onChange={handleInputChange} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                    <div className="flex flex-col flex-1 gap-y-1">
                        Pekerjaan
                        <input type="text" name="family_occupation" id="family_occupation" value={formData.family_occupation} onChange={handleInputChange} className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                    </div>
                </div>
            </div></>
    )
}
export default FamilyInformation;