'use client';
import React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from 'next/image';
import styles from './signin.module.css';
import Link from "next/link";
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';

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
                title: "Try again",
                text: "Passwords don not match",
                icon: "warning",
                timer: 2000,
                confirmButtonColor: "#739072" 
            });
            setError("Passwords do not match!");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fullname: fullName,
                    email: email,
                    password: password,
                    strnumber: strNumber
                }),
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    title: "Registration Successful",
                    text: "User registered successfully!",
                    icon: "success",
                    timer: 2000,
                    confirmButtonColor: "#739072" 
                });

                if (data.user_id) {
                    Cookies.set('access_token', data.access_token, { expires: 1 });
                    localStorage.setItem('temp_user_id', data.user_id);
                    router.push('/register-clinic');
                }
            } else {
                setLoading(false);
                Swal.fire({
                    title: "Registration Failed",
                    text: data.msg || "Something went wrong",
                    icon: "error",
                    confirmButtonColor: "#739072" ,
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
                        <h3>Full Name</h3>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        /></div>
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
                    <div className="w-full"><h3>Confirm Password</h3>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPasword(e.target.value)}
                        /></div>
                    <div className="w-full"> <h3>STR Number</h3>
                        <input
                            type="text"
                            value={strNumber}
                            onChange={(e) => setStrNumber(e.target.value)}
                        /></div>
                    <p className="text-[#766E6E]">Already have an account? <Link href="/login"><u>Click Here</u></Link></p>
                    <button onClick={handleRegister} className="bg-[#739072] text-[#FFF] font-poppins font-bold py-2 px-4 w-35 rounded-[30px] cursor-pointer">{loading ? "Registering..." : "Sign Up"}</button>
                    <div className="flex  w-full justify-center items-center gap-3">
                        <div className="w-30 h-0.5 bg-black "></div>
                        <p className="text-[#766E6E]">or Sign in with</p>
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