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

const translateLoginMessage = (message: string) => {
    const normalized = String(message || '').toLowerCase();

    if (
        normalized.includes('invalid') ||
        normalized.includes('wrong password') ||
        normalized.includes('email or password')
    ) {
        return 'Email atau kata sandi tidak sesuai.';
    }

    if (normalized.includes('inactive')) {
        return 'Akun Anda sedang tidak aktif. Silakan hubungi admin.';
    }

    if (normalized.includes('not found')) {
        return 'Akun tidak ditemukan.';
    }

    if (normalized.includes('required')) {
        return 'Email dan kata sandi wajib diisi.';
    }

    if (normalized.includes('failed to fetch')) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    return message || 'Login gagal. Silakan coba lagi.';
};

const EyeOpenIcon = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M2 12C3.8 8.5 7.4 6 12 6C16.6 6 20.2 8.5 22 12C20.2 15.5 16.6 18 12 18C7.4 18 3.8 15.5 2 12Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <circle
            cx="12"
            cy="12"
            r="3"
            stroke="currentColor"
            strokeWidth="1.8"
        />
    </svg>
);

const EyeClosedIcon = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M3 3L21 21"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
        />
        <path
            d="M10.58 10.58C10.21 10.95 10 11.46 10 12C10 13.1 10.9 14 12 14C12.54 14 13.05 13.79 13.42 13.42"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M9.88 5.09C10.56 4.97 11.27 4.9 12 4.9C16.6 4.9 20.2 7.4 22 10.9C21.27 12.32 20.27 13.55 19.08 14.52"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M6.23 6.23C4.46 7.39 3.02 9.02 2 10.9C3.8 14.4 7.4 16.9 12 16.9C13.83 16.9 15.47 16.5 16.88 15.79"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const Login = () => {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

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
                const message = translateLoginMessage(data?.msg || 'Login gagal');
                setError(message);

                await Swal.fire({
                    title: 'Gagal Masuk',
                    text: message,
                    icon: 'error',
                    confirmButtonColor: '#739072',
                    timer: 2200,
                });

                return;
            }

            if (!data.access_token || !data.user) {
                const message =
                    'Respon login dari server tidak lengkap. Silakan coba lagi.';
                setError(message);

                await Swal.fire({
                    title: 'Gagal Masuk',
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
                title: 'Berhasil Masuk',
                text: 'Selamat datang kembali!',
                icon: 'success',
                timer: 1400,
                showConfirmButton: false,
                confirmButtonColor: '#739072',
            });

            router.push(data.redirect_path || '/dashboard');
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateLoginMessage(error.message)
                    : 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';

            setError(message);

            await Swal.fire({
                title: 'Gagal Masuk',
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
        <main className={styles.page}>
            <section className={styles.leftPanel}>
                <div className={styles.overlay} />

                <div className={styles.logoArea}>
                    <div className={styles.logoBox}>
                        <Image
                            src="/Logo-Clinic.jpeg"
                            alt="Logo Clinic"
                            width={42}
                            height={42}
                            className={styles.logoImage}
                            priority
                        />
                        <div className={styles.logoText}>
                            <h2>Clinic Yanto</h2>
                            <p>Clinic Management System</p>
                        </div>
                    </div>
                </div>

                <div className={styles.leftContent}>
                    <div className={styles.heroText}>
                        <p className={styles.badge}>Sistem Klinik Digital</p>

                        <h1>Clinic Management</h1>

                        <p className={styles.description}>
                            Sistem yang membantu klinik mengelola data pasien,
                            aktivitas layanan, rekam medis, laporan, serta
                            operasional harian agar lebih rapi, aman, dan
                            efisien.
                        </p>
                    </div>
                </div>
            </section>

            <section className={styles.rightPanel}>
                <div className={styles.formCard}>
                    <div className={styles.formHeader}>
                        <h2>Masuk</h2>
                        <p>
                            Silakan masuk menggunakan akun yang sudah diberikan
                            oleh admin klinik.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                disabled={loading}
                                required
                                autoComplete="email"
                                placeholder="Masukkan email"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password">Kata Sandi</label>

                            <div className={styles.passwordWrapper}>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    disabled={loading}
                                    required
                                    autoComplete="current-password"
                                    placeholder="Masukkan kata sandi"
                                />

                                <button
                                    type="button"
                                    className={styles.eyeButton}
                                    onClick={() =>
                                        setShowPassword((prev) => !prev)
                                    }
                                    disabled={loading}
                                    aria-label={
                                        showPassword
                                            ? 'Sembunyikan kata sandi'
                                            : 'Tampilkan kata sandi'
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOpenIcon />
                                    ) : (
                                        <EyeClosedIcon />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className={styles.errorBox}>{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={styles.loginButton}
                        >
                            {loading ? 'Sedang Masuk...' : 'Masuk'}
                        </button>

                        <p className={styles.bottomInfo}>
                            Akun dibuat oleh admin melalui menu pengaturan
                            manajemen.
                        </p>
                    </form>
                </div>
            </section>
        </main>
    );
};

export default Login;