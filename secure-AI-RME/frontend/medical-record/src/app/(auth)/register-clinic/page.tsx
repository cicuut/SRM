'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';
import styles from './registerClinic.module.css';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type CurrentUserResponse = {
    msg?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role: string;
        clinic_id?: string | null;
        is_active?: boolean;
    };
    clinic?: {
        id: string;
        clinic_name: string;
        clinic_address: string;
        license_number: string;
        clinic_email: string;
        clinic_phone: string;
    } | null;
};

type RegisterClinicResponse = {
    msg?: string;
    access_token?: string;
    redirect_path?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role: string;
        clinic_id?: string | null;
    };
    clinic?: {
        id: string;
        clinic_name: string;
        clinic_address: string;
        license_number: string;
        clinic_email: string;
        clinic_phone: string;
    } | null;
};

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const translateMessage = (message: string) => {
    const normalized = String(message || '').toLowerCase();

    if (normalized.includes('clinic email is taken')) {
        return 'Email klinik sudah digunakan.';
    }

    if (normalized.includes('sipb') || normalized.includes('license')) {
        return 'Nomor praktik / SIPB sudah digunakan.';
    }

    if (normalized.includes('not linked')) {
        return 'Akun belum terhubung ke klinik.';
    }

    if (normalized.includes('only admin')) {
        return 'Hanya admin yang dapat mengatur informasi klinik.';
    }

    if (normalized.includes('failed to fetch')) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    return message || 'Terjadi kesalahan. Silakan coba lagi.';
};

const CreateClinic = () => {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [clinicName, setClinicName] = useState('');
    const [sipbNumber, setSipbNumber] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAccess, setCheckingAccess] = useState(true);

    const getToken = () => {
        return Cookies.get('access_token');
    };

    const handleUnauthorized = () => {
        Cookies.remove('access_token');

        localStorage.removeItem('user_id');
        localStorage.removeItem('fullname');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('clinic_id');

        router.push('/login');
    };

    const fetchCurrentUser = async () => {
        try {
            setCheckingAccess(true);
            setError('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = (await readJson(response)) as CurrentUserResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal mengambil data pengguna');
            }

            if (data.user?.role !== 'admin') {
                await Swal.fire({
                    title: 'Akses Ditolak',
                    text: 'Hanya admin yang dapat mengatur informasi klinik.',
                    icon: 'warning',
                    confirmButtonColor: '#739072',
                });

                router.push('/dashboard');
                return;
            }

            if (data.clinic) {
                setClinicName(data.clinic.clinic_name || '');
                setSipbNumber(data.clinic.license_number || '');
                setPhone(data.clinic.clinic_phone || '');
                setEmail(data.clinic.clinic_email || '');
                setAddress(data.clinic.clinic_address || '');
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';

            setError(message);

            await Swal.fire({
                title: 'Gagal',
                text: message,
                icon: 'error',
                confirmButtonColor: '#739072',
            });
        } finally {
            setCheckingAccess(false);
        }
    };

    useEffect(() => {
        fetchCurrentUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const validateForm = () => {
        if (!clinicName.trim()) {
            return 'Nama klinik wajib diisi.';
        }

        if (!sipbNumber.trim()) {
            return 'Nomor praktik / SIPB wajib diisi.';
        }

        if (!phone.trim()) {
            return 'Nomor telepon wajib diisi.';
        }

        if (!email.trim()) {
            return 'Email klinik wajib diisi.';
        }

        if (!email.includes('@')) {
            return 'Format email klinik tidak valid.';
        }

        if (!address.trim()) {
            return 'Alamat lengkap wajib diisi.';
        }

        return '';
    };

    const handleCreateClinic = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading) return;

        try {
            setError('');
            setLoading(true);

            const validationMessage = validateForm();

            if (validationMessage) {
                setError(validationMessage);

                await Swal.fire({
                    title: 'Data Belum Lengkap',
                    text: validationMessage,
                    icon: 'warning',
                    confirmButtonColor: '#739072',
                    timer: 2200,
                });

                return;
            }

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await fetch(`${API_BASE_URL}/auth/register-clinic`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clinic_name: clinicName.trim(),
                    clinic_email: email.trim().toLowerCase(),
                    license_number: sipbNumber.trim(),
                    clinic_address: address.trim(),
                    clinic_phone: phone.trim(),
                }),
            });

            const data = (await readJson(response)) as RegisterClinicResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.msg || 'Gagal menyimpan informasi klinik');
            }

            if (data.access_token) {
                Cookies.set('access_token', data.access_token, {
                    expires: 1,
                    path: '/',
                    sameSite: 'Lax',
                });
            }

            if (data.user) {
                localStorage.setItem('user_id', data.user.id || '');
                localStorage.setItem('fullname', data.user.fullname || '');
                localStorage.setItem('user_email', data.user.email || '');
                localStorage.setItem('user_role', data.user.role || '');
                localStorage.setItem('clinic_id', data.user.clinic_id || '');
            }

            if (data.clinic?.id) {
                localStorage.setItem('clinic_id', data.clinic.id);
            }

            await Swal.fire({
                title: 'Berhasil',
                text: 'Informasi klinik berhasil disimpan.',
                icon: 'success',
                timer: 1600,
                showConfirmButton: false,
                confirmButtonColor: '#739072',
            });

            router.push(data.redirect_path || '/dashboard');
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateMessage(error.message)
                    : 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';

            setError(message);

            await Swal.fire({
                title: 'Gagal Menyimpan',
                text: message,
                icon: 'error',
                confirmButtonColor: '#739072',
                timer: 2400,
            });
        } finally {
            setLoading(false);
        }
    };

    if (checkingAccess) {
        return (
            <main className={styles.loadingPage}>
                <div className={styles.loadingCard}>
                    <Image
                        src="/icon-1.png"
                        alt="Logo NADI"
                        width={56}
                        height={56}
                        priority
                    />
                    <p>Memeriksa akses klinik...</p>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <section className={styles.leftPanel}>
                <div className={styles.overlay} />

                <div className={styles.logoArea}>
                    <div className={styles.logoBox}>
                        <Image
                            src="/icon-1.png"
                            alt="Logo NADI"
                            width={42}
                            height={42}
                            className={styles.logoImage}
                            priority
                        />

                        <div className={styles.logoText}>
                            <h2>NADI</h2>
                            <p>Clinic Management System</p>
                        </div>
                    </div>
                </div>

                <div className={styles.leftContent}>
                    <div className={styles.heroText}>
                        <p className={styles.badge}>Setup Awal Klinik</p>

                        <h1>Pengaturan Klinik</h1>

                        <p className={styles.description}>
                            Lengkapi informasi klinik untuk mengaktifkan sistem.
                            Data ini akan digunakan pada akun pengguna, laporan,
                            rekam medis, dan aktivitas operasional klinik.
                        </p>
                    </div>
                </div>
            </section>

            <section className={styles.rightPanel}>
                <div className={styles.formCard}>
                    <div className={styles.formHeader}>
                        <h2>Informasi Klinik</h2>

                        <p>
                            Isi data klinik dengan benar. Informasi ini dapat
                            diperbarui kembali oleh admin melalui pengaturan
                            manajemen.
                        </p>
                    </div>

                    <form
                        onSubmit={handleCreateClinic}
                        className={styles.form}
                    >
                        <div className={styles.inputGroup}>
                            <label htmlFor="clinicName">Nama Klinik</label>

                            <input
                                id="clinicName"
                                type="text"
                                value={clinicName}
                                onChange={(event) =>
                                    setClinicName(event.target.value)
                                }
                                disabled={loading}
                                required
                                placeholder="Contoh: Klinik Bidan Sehat"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="sipbNumber">
                                Nomor Praktik / SIPB
                            </label>

                            <input
                                id="sipbNumber"
                                type="text"
                                value={sipbNumber}
                                onChange={(event) =>
                                    setSipbNumber(event.target.value)
                                }
                                disabled={loading}
                                required
                                placeholder="Masukkan nomor praktik"
                            />
                        </div>

                        <div className={styles.twoColumns}>
                            <div className={styles.inputGroup}>
                                <label htmlFor="phone">Nomor Telepon</label>

                                <input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(event) =>
                                        setPhone(event.target.value)
                                    }
                                    disabled={loading}
                                    required
                                    placeholder="08xxxxxxxxxx"
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label htmlFor="email">Email Klinik</label>

                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    disabled={loading}
                                    required
                                    placeholder="klinik@email.com"
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="address">Alamat Lengkap</label>

                            <textarea
                                id="address"
                                value={address}
                                onChange={(event) =>
                                    setAddress(event.target.value)
                                }
                                disabled={loading}
                                required
                                rows={4}
                                placeholder="Masukkan alamat lengkap klinik"
                            />
                        </div>

                        {error && (
                            <div className={styles.errorBox}>{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={styles.submitButton}
                        >
                            {loading
                                ? 'Menyimpan...'
                                : 'Simpan Informasi Klinik'}
                        </button>

                        <p className={styles.bottomInfo}>
                            Halaman ini hanya dapat diakses oleh admin.
                        </p>
                    </form>
                </div>
            </section>
        </main>
    );
};

export default CreateClinic;