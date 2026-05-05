'use client';
import React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from 'next/image';
import styles from './registerClinic.module.css';
import Link from "next/link";
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';
import api from "@/utils/app";

const CreateClinic = () => {
    const [email, setEmail] = useState("")
    const [clinicName, setClinicName] = useState("");
    const [sipbNumber, setSipbNumber] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const router = useRouter();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreateClinic = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const tempUserId = localStorage.getItem('temp_user_id');
            const response = await api.post('/auth/register-clinic', {
                    user_id: tempUserId,
                    clinic_name: clinicName,
                    clinic_email: email,
                    license_number: sipbNumber,
                    clinic_address: address,
                    clinic_phone: phone
    
            });

            const data =  response.data;

            if (response.status === 201) {
                const userData = data.user_id;
                if (userData) {
                        localStorage.setItem('temp_user_id', userData);
                    }   await Swal.fire({
                        title: "Pendaftaran Berhasil",
                        text: "Klinik berhasil didaftarkan",
                        icon: "success",
                        timer: 2000,
                        showConfirmButton: false
                    });
                router.push('/dashboard');
            } 
        }  catch (err: any) {
            const errorMsg = err.response?.data?.msg || "Something went wrong";
             setError(errorMsg);
                Swal.fire({
                    title: "Pendaftaran Gagal",
                    text:errorMsg,
                    icon: "error",
                    timer: 2000,
                    showConfirmButton: false
                });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="container bg-[#D2E3C8]">
            <div className="flex flex-col items-center justify-center w-1/2 gap-4">

                <Image src="/hospital-icon.png" alt="Icon" width={400} height={400} />
                <div className="w-1/2 text-center">
                    <p className="text-[#739072] text-4xl" >Masukan informasi klinik, untuk mendapatkan fitur lebih  menarik</p>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center w-1/2 gap-4 bg-[#FFF] rounded-tl-[10%] rounded-bl-[10%]">
                <div className={styles['regist-input-wrapper']}>
                    <h1 className="regist-input-wrapper text-center text-[#4F6F52] text-2xl font-bold">Create Your Clinic</h1>
                    <div className="w-full">
                        <h3>Nama klinik</h3>
                        <input
                            type="text"
                            value={clinicName}
                            onChange={(e) => setClinicName(e.target.value)}
                        /></div>
                    <div className="w-full">
                        <h3>Nomor Praktek</h3>
                        <input
                            type="text"
                            value={sipbNumber}
                            onChange={(e) => setSipbNumber(e.target.value)}
                        /></div>
                    <div className="w-full">
                        <h3>No Telepon</h3>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        /></div>
                    <div className="w-full"><h3>Email</h3>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        /></div>
                    <div className="w-full"> <h3>Alamat Lengkap</h3>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        /></div>
                    <button onClick={handleCreateClinic} className="bg-[#739072] text-[#FFF] font-poppins font-bold py-2 px-4 w-35 rounded-[30px] cursor-pointer">{loading ? "Submitting..." : "Submit Klinik"}</button>
                </div>
            </div>
        </div>
    )

}
export default CreateClinic;