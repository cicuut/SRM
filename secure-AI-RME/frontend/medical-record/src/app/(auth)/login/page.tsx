'use client';
import React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from 'next/image';
import { emit } from "process";
import styles from './login.module.css';
import Link from "next/link";
import Swal from "sweetalert2";
import Cookies from "js-cookie";
import api from "@/utils/app";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await api.post('/auth/login', {
                    email: email,
                    password: password
            });

            const data = response.data;

            if (response.status === 200) {
                const userData = data.user 

                if (userData) {
                    Cookies.set('access_token', data.access_token, { expires: 1 });
                    localStorage.setItem('temp_user_id', data.user.id);
                    localStorage.setItem('fullname', data.user.fullname);
                    localStorage.setItem('user_role', data.user.role);

                    Swal.fire({
                        title: "Login Sukses",
                        text: "Selamat Datang!",
                        icon: "success",
                        timer: 2000,
                        showConfirmButton: false
                      
                    });
                }
                    router.push('/dashboard');
                
            } 
        } catch (err: any) {
            const errorMsg = err.response?.data?.msg || "Something went wrong";
        
        setError(errorMsg);
            setLoading(false);
                Swal.fire({
                    title: "Login Failed",
                    text: errorMsg,
                    icon: "error",
                   showConfirmButton: false,
                    timer: 2000
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
                        <h3>Email</h3>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        /></div>
                    <div className="w-full">
                        <h3>Password</h3>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        /></div>
                    <p className="text-[#766E6E]">Lupa Password? <Link href="/forgot-password"><u>Pergi ke Sini</u></Link></p>
                    <button onClick={handleLogin} className="bg-[#739072] text-[#FFF] font-poppins font-bold py-2 px-4 w-30 rounded-[30px] cursor-pointer">{loading ? "Logging..." : "Log In"}</button>
                    <div className="flex  w-full justify-center items-center gap-3">
                        <div className="w-30 h-0.5 bg-black "></div>
                        <p className="text-[#766E6E]">atau masuk dengan</p>
                        <div className="w-30 h-0.5 bg-black"></div>
                    </div>
                </div>
            </div>
        </div>
    )

}
export default Login;