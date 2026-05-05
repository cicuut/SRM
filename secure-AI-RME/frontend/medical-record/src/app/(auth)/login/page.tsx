'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';
import styles from './login.module.css';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type LoginResponse = {
    msg?: string;
    access_token?: string;
    redirect_path?: string;
    requires_clinic_setup?: boolean;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role: string;
        clinic_id?: string | null;
        is_active?: boolean;
    };
};

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const Login = () => {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading) return;

        try {
            setError('');
            setLoading(true);

            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                }),
            });

            const data = (await readJson(response)) as LoginResponse;

            if (!response.ok) {
                const message = data?.msg || 'Login gagal';
                setError(message);

                await Swal.fire({
                    title: 'Login Failed',
                    text: message,
                    icon: 'error',
                    confirmButtonColor: '#739072',
                    timer: 2200,
                });

                return;
            }

            if (!data.access_token || !data.user) {
                const message = 'Login response tidak lengkap dari server';
                setError(message);

                await Swal.fire({
                    title: 'Login Failed',
                    text: message,
                    icon: 'error',
                    confirmButtonColor: '#739072',
                });

                return;
            }

            Cookies.set('access_token', data.access_token, {
                expires: 1,
                path: '/',
                sameSite: 'Lax',
            });

            localStorage.setItem('user_id', data.user.id || '');
            localStorage.setItem('fullname', data.user.fullname || '');
            localStorage.setItem('user_email', data.user.email || '');
            localStorage.setItem('user_role', data.user.role || '');
            localStorage.setItem('clinic_id', data.user.clinic_id || '');

            await Swal.fire({
                title: 'Login Sukses',
                text: 'Selamat datang!',
                icon: 'success',
                timer: 1400,
                showConfirmButton: false,
                confirmButtonColor: '#739072',
            });

            router.push(data.redirect_path || '/dashboard');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Cannot connect to server. Is Flask running?';

            setError(message);

            await Swal.fire({
                title: 'Login Failed',
                text: message,
                icon: 'error',
                confirmButtonColor: '#739072',
                timer: 2200,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container bg-[#D2E3C8]">
            <div className="flex w-1/2 flex-col items-center justify-center gap-4">
                <Image src="/icon-1.png" alt="Icon" width={300} height={300} />

                <h1 className="font-poppins text-6xl font-bold text-[#FFF] drop-shadow-lg">
                    NADI
                </h1>

                <div className="w-1/2 text-center">
                    <p className="text-4xl text-[#739072]">
                        The Digital Heartbeat of Your Clinic.
                    </p>
                </div>
            </div>

            <div className="flex w-1/2 flex-col items-center justify-center gap-4 rounded-bl-[10%] rounded-tl-[10%] bg-[#FFF]">
                <form
                    onSubmit={handleLogin}
                    className={styles['regist-input-wrapper']}
                >
                    <h1 className="text-center text-2xl font-bold text-[#4F6F52]">
                        Welcome Back
                    </h1>

                    <p className="max-w-[360px] text-center text-[12px] leading-5 text-[#766E6E]">
                        Akun hanya dapat dibuat oleh admin melalui Management
                        Setting.
                    </p>

                    <div className="w-full">
                        <h3>Email</h3>

                        <input
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            disabled={loading}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="w-full">
                        <h3>Password</h3>

                        <input
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            disabled={loading}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <p className="w-full rounded-[6px] bg-red-50 px-3 py-2 text-center text-[12px] text-red-600">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="min-w-30 cursor-pointer rounded-[30px] bg-[#739072] px-4 py-2 font-poppins font-bold text-[#FFF] transition-all hover:bg-[#5F785F] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {loading ? 'Logging...' : 'Log In'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;