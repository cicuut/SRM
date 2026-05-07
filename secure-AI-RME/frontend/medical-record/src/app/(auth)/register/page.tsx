'use client';
import React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from 'next/image';
import styles from './signin.module.css';
import Link from "next/link";
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';
import api from "@/utils/app";

const Signin = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPasword] = useState("");
    const [strNumber, setStrNumber] = useState("");
    const [fullName, setFullName] = useState("");
    const router = useRouter();

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);


        if (password !== confirmPassword) {
            Swal.fire({
                title: "Coba Lagi",
                text: "Password tidak sama",
                icon: "warning",
                timer: 2000,
                confirmButtonColor: "#739072" 
            });
            setError("Passwords do not match!");
            setLoading(false);
            return;
        }

        try {
            const response = await api.post('/auth/register', {
                    fullname: fullName,
                    email: email,
                    password: password,
                    strnumber: strNumber
            });

            const data = response.data;

            if (response.status === 201) {
                Swal.fire({
                    title: "Pendaftaran Sukses",
                    text: "Berhasil menambahkan pengguna",
                    icon: "success",
                    timer: 2000,
                    showConfirmButton: false
                });

                if (data.user_id) {
                    Cookies.set('access_token', data.access_token, { expires: 1 });
                    localStorage.setItem('temp_user_id', data.user_id);
                    router.push('/register-clinic');
                }
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
                <Image src="/icon-1.png" alt="Icon" width={300} height={300} />
                <h1 className="font-poppins text-[#FFF] font-bold text-6xl drop-shadow-lg">NADI</h1>
                <div className="w-1/2 text-center">
                    <p className="text-[#739072] text-4xl" >The Digital Heartbeat of Your Clinic.</p>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center w-1/2 gap-4 bg-[#FFF] rounded-tl-[10%] rounded-bl-[10%]">
                <div className={styles['regist-input-wrapper']}>
                    <h1 className="regist-input-wrapper text-center text-[#4F6F52] text-2xl font-bold">Hello There</h1>
                    <div className="w-full">
                        <h3>Full Name <span className="text-red-500">*</span></h3>
                        <input
                            type="text"
                            value={fullName}
                            required
                            onChange={(e) => setFullName(e.target.value)}
                        /></div>
                    <div className="w-full">
                        <h3>Email <span className="text-red-500">*</span></h3>
                        <input
                            type="email"
                            value={email}
                            required
                            onChange={(e) => setEmail(e.target.value)}
                        /></div>
                    <div className="w-full">
                        <h3>Password <span className="text-red-500">*</span></h3>
                        <input
                            type="password"
                            value={password}
                            required
                            onChange={(e) => setPassword(e.target.value)}
                        /></div>
                    <div className="w-full"><h3>Confirm Password <span className="text-red-500">*</span></h3>
                        <input
                            type="password"
                            value={confirmPassword}
                            required
                            onChange={(e) => setConfirmPasword(e.target.value)}
                        /></div>
                    <div className="w-full"> <h3>STR Number</h3>
                        <input
                            type="text"
                            value={strNumber}
                            onChange={(e) => setStrNumber(e.target.value)}
                        /></div>
                    <p className="text-[#766E6E]">Sudah punya akun?<Link href="/login"><u>Pergi ke Sini</u></Link></p>
                    <button onClick={handleRegister} className="bg-[#739072] text-[#FFF] font-poppins font-bold py-2 px-4 w-35 rounded-[30px] cursor-pointer">{loading ? "Registering..." : "Sign Up"}</button>
                    <div className="flex  w-full justify-center items-center gap-3">
                        <div className="w-30 h-0.5 bg-black "></div>
                        <p className="text-[#766E6E]">atau daftar dengan</p>
                        <div className="w-30 h-0.5 bg-black"></div>
                    </div>
                    <button className="mt-10 flex gap-2 w-40 items-center justify-center border-[2] py-2 px-2 rounded-[30px]">
                        <Image src="/google-icon.svg" alt="Google" width={25} height={25} />
                        <p>Google</p>
                    </button>
                </div>
            </div>
        </div>
    )

}
export default Signin;