'use client';
import React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from 'next/image';
import styles from './registerClinic.module.css';
import Link from "next/link";
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';

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
            const response = await fetch('http://localhost:5000/api/auth/register-clinic', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: tempUserId,
                    clinic_name: clinicName,
                    clinic_email: email,
                    license_number: sipbNumber,
                    clinic_address: address,
                    clinic_phone: phone
                }),
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    title: "Clinic Registration Successful",
                    icon: "success"
                });
                localStorage.setItem('temp_user_id', data.user_id);
                router.push('/dashboard');
            } else {
                setLoading(false);
                Swal.fire({
                    title: "Registration Failed",
                    text: data.msg || "Something went wrong",
                    icon: "error"
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

                <Image src="/hospital-icon.png" alt="Icon" width={400} height={400} />
                <div className="w-1/2 text-center">
                    <p className="text-[#739072] text-4xl" >Create Your Clinic First to Enjoy Our Features</p>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center w-1/2 gap-4 bg-[#FFF] rounded-tl-[10%] rounded-bl-[10%]">
                <div className={styles['regist-input-wrapper']}>
                    <h1 className="regist-input-wrapper text-center text-[#4F6F52] text-2xl font-bold">Create Your Clinic</h1>
                    <div className="w-full">
                        <h3>Clinic Name</h3>
                        <input
                            type="text"
                            value={clinicName}
                            onChange={(e) => setClinicName(e.target.value)}
                        /></div>
                    <div className="w-full">
                        <h3>Practice License Number</h3>
                        <input
                            type="text"
                            value={sipbNumber}
                            onChange={(e) => setSipbNumber(e.target.value)}
                        /></div>
                    <div className="w-full">
                        <h3>Official Phone Number</h3>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        /></div>
                    <div className="w-full"><h3>Official Email</h3>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        /></div>
                    <div className="w-full"> <h3>Full Address</h3>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        /></div>
                    <button onClick={handleCreateClinic} className="bg-[#739072] text-[#FFF] font-poppins font-bold py-2 px-4 w-35 rounded-[30px] cursor-pointer">{loading ? "Submitting..." : "Submit Clinic"}</button>
                </div>
            </div>
        </div>
    )

}
export default CreateClinic;