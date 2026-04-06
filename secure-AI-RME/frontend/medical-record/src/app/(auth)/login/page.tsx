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
            const response = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                }),
            });

            const data = await response.json();

            if (response.ok) {
                const userData = data.user 

                if (userData) {
                    Cookies.set('access_token', data.access_token, { expires: 1 });
                    localStorage.setItem('temp_user_id', data.user.id);
                    localStorage.setItem('fullname', data.user.fullname);
                    localStorage.setItem('user_role', data.user.role);

                    Swal.fire({
                        title: "Login Successful",
                        text: "Welcome!",
                        icon: "success",
                        timer: 2000,
                        confirmButtonColor: "#739072"
                    });
                }
                    router.push('/dashboard');
                
            } else {
                setLoading(false);
                Swal.fire({
                    title: "Login Failed",
                    text: data.msg || "Something went wrong",
                    icon: "error",
                    confirmButtonColor: "#739072",
                    timer: 2000
                });
                setError(data.msg);
            }
        } catch (err) {
            setError("Cannot connect to server. Is Flask running?");
            console.error(err);
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
                    <p className="text-[#766E6E]">Don't have an account? <Link href="/register"><u>Click Here</u></Link></p>
                    <button onClick={handleLogin} className="bg-[#739072] text-[#FFF] font-poppins font-bold py-2 px-4 w-30 rounded-[30px] cursor-pointer">{loading ? "Logging..." : "Log In"}</button>
                    <div className="flex  w-full justify-center items-center gap-3">
                        <div className="w-30 h-0.5 bg-black "></div>
                        <p className="text-[#766E6E]">or Log in with</p>
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
export default Login;