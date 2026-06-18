'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';
import styles from './registerClinic.module.css';
import api from '@/utils/app';


type Role = 'admin' | 'midwife' | 'asisten' | '';

type CurrentUserResponse = {
    msg?: string;
    requires_clinic_setup?: boolean;
    redirect_path?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role?: string;
        user_role?: string;
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
    requires_clinic_setup?: boolean;
    redirect_path?: string;
    user?: {
        id: string;
        fullname: string;
        email: string;
        role?: string;
        user_role?: string;
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

const normalizeRole = (role?: string | null): Role => {
    const normalizedRole = String(role || '').trim().toLowerCase();

    if (normalizedRole === 'admin') return 'admin';
    if (normalizedRole === 'developer') return 'admin';

    if (normalizedRole === 'midwife') return 'midwife';
    if (normalizedRole === 'bidan') return 'midwife';
    if (normalizedRole === 'owner') return 'midwife';

    if (normalizedRole === 'asisten') return 'asisten';
    if (normalizedRole === 'assistant') return 'asisten';
    if (normalizedRole === 'staff') return 'asisten';

    return '';
};

const translateErrorMessage = (message?: string) => {
    const normalized = String(message || '').toLowerCase();

    if (normalized.includes('failed to fetch')) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    if (normalized.includes('network error')) {
        return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
    }

    if (normalized.includes('clinic email is taken')) {
        return 'Email klinik sudah digunakan.';
    }

    if (normalized.includes('email klinik sudah digunakan')) {
        return 'Email klinik sudah digunakan.';
    }

    if (normalized.includes('sipb number is taken')) {
        return 'Nomor SIPB sudah digunakan.';
    }

    if (normalized.includes('nomor sipb sudah digunakan')) {
        return 'Nomor SIPB sudah digunakan.';
    }

    if (normalized.includes('all clinic data must be filled')) {
        return 'Semua data klinik wajib diisi.';
    }

    if (normalized.includes('only midwife')) {
        return 'Hanya bidan yang dapat membuat atau memperbarui data klinik.';
    }

    if (normalized.includes('hanya bidan')) {
        return message || 'Hanya bidan yang dapat membuat atau memperbarui data klinik.';
    }

    if (normalized.includes('inactive') || normalized.includes('tidak aktif')) {
        return 'Akun Anda sedang tidak aktif.';
    }

    return message || 'Terjadi kesalahan. Silakan coba lagi.';
};

const clearSession = () => {
    Cookies.remove('access_token', { path: '/' });

    if (typeof window === 'undefined') return;

    localStorage.removeItem('user_id');
    localStorage.removeItem('temp_user_id');
    localStorage.removeItem('fullname');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    localStorage.removeItem('clinic_id');
    localStorage.removeItem('profile_photo');
    localStorage.removeItem('requires_clinic_setup');
};

const saveSessionFromResponse = (data: RegisterClinicResponse) => {
    if (data.access_token) {
        Cookies.set('access_token', data.access_token, {
            expires: 1,
            path: '/',
            sameSite: 'Lax',
        });
    }

    if (typeof window === 'undefined') return;

    if (data.user) {
        const role = normalizeRole(data.user.role || data.user.user_role);

        localStorage.setItem('user_id', data.user.id || '');
        localStorage.setItem('temp_user_id', data.user.id || '');
        localStorage.setItem('fullname', data.user.fullname || '');
        localStorage.setItem('user_email', data.user.email || '');
        localStorage.setItem('user_role', role || '');
        localStorage.setItem('clinic_id', data.user.clinic_id || '');
        localStorage.setItem(
            'requires_clinic_setup',
            data.requires_clinic_setup ? 'true' : 'false',
        );
    }

    if (data.clinic?.id) {
        localStorage.setItem('clinic_id', data.clinic.id);
        localStorage.setItem('requires_clinic_setup', 'false');
    }
};

const LeftPanel = () => {
    return (
        <section className={styles.leftPanel}>
            <div className={styles.overlay} />

            <div className={styles.logoArea}>
                <div className={styles.logoBox}>
                    <Image
                        src="/logo.png"
                        alt="Logo Clinic"
                        width={42}
                        height={42}
                        className={styles.logoImage}
                        priority
                    />

                    <div className={styles.logoText}>
                        <h2>Praktek Bidan Mandiri</h2>
                        <p>Bidan Evi Susanti</p>
                    </div>
                </div>
            </div>

            <div className={styles.leftContent}>
                <div className={styles.heroText}>
                    <p className={styles.badge}>Sistem Klinik Digital</p>

                    <h1>Sistem Manajemen</h1>

                    <p className={styles.description}>
                        Sistem yang membantu klinik mengelola data pasien,
                        aktivitas layanan, rekam medis, laporan, serta
                        operasional harian agar lebih rapi, aman, dan efisien.
                    </p>
                </div>
            </div>
        </section>
    );
};

const ForbiddenView = () => {
    return (
        <main className={styles.forbiddenPage}>
            <section className={styles.forbiddenCard}>
                <div className={styles.forbiddenCode}>403</div>

                <h1>Forbidden Access</h1>

                <p>
                    Kamu tidak memiliki izin untuk mengakses halaman pendaftaran
                    klinik.
                </p>

                <span>Halaman ini hanya dapat digunakan oleh admin dan bidan.</span>
            </section>
        </main>
    );
};

const DeveloperInfoView = ({
    adminName,
    onGoDashboard,
    onGoManagement,
}: {
    adminName: string;
    onGoDashboard: () => void;
    onGoManagement: () => void;
}) => {
    return (
        <main className={styles.page}>
            <LeftPanel />

            <section className={styles.rightPanel}>
                <div className={styles.formCard}>
                    <div className={styles.formHeader}>
                        <h2>Mode Admin Developer</h2>

                        <p>
                            {adminName
                                ? `Masuk sebagai admin: ${adminName}`
                                : 'Admin dapat mengakses halaman ini sebagai developer.'}
                        </p>
                    </div>

                    <div className={styles.infoBox}>
                        Admin tidak wajib membuat data klinik karena admin
                        berperan sebagai developer sistem. Pendaftaran klinik
                        dilakukan oleh akun bidan saat pertama kali login.
                    </div>

                    <div className={styles.buttonGroup}>
                        <button
                            type="button"
                            onClick={onGoManagement}
                            className={styles.secondaryButton}
                        >
                            Management
                        </button>

                        <button
                            type="button"
                            onClick={onGoDashboard}
                            className={styles.loginButton}
                        >
                            Ke Dashboard
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
};

const CreateClinic = () => {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [clinicName, setClinicName] = useState('');
    const [sipbNumber, setSipbNumber] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    const [currentRole, setCurrentRole] = useState<Role>('');
    const [currentUserName, setCurrentUserName] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [isForbidden, setIsForbidden] = useState(false);

    const getToken = () => {
        return Cookies.get('access_token');
    };

    const handleUnauthorized = () => {
        clearSession();
        router.push('/login');
    };

    const fillClinicForm = (clinic?: CurrentUserResponse['clinic']) => {
        if (!clinic) return;

        setClinicName(clinic.clinic_name || '');
        setSipbNumber(clinic.license_number || '');
        setPhone(clinic.clinic_phone || '');
        setEmail(clinic.clinic_email || '');
        setAddress(clinic.clinic_address || '');
    };

    const fetchCurrentUser = async () => {
        try {
            setCheckingAccess(true);
            setIsForbidden(false);
            setError('');

            const token = getToken();

            if (!token) {
                handleUnauthorized();
                return;
            }

            const response = await api.get(`/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = response.data as CurrentUserResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                setIsForbidden(true);
                return;
            }

            if (response.status !== 200 || !data.user) {
                throw new Error(data?.msg || 'Gagal mengambil data user.');
            }

            const role = normalizeRole(data.user.role || data.user.user_role);

            setCurrentRole(role);
            setCurrentUserName(data.user.fullname || '');

            if (typeof window !== 'undefined') {
                localStorage.setItem('user_id', data.user.id || '');
                localStorage.setItem('temp_user_id', data.user.id || '');
                localStorage.setItem('fullname', data.user.fullname || '');
                localStorage.setItem('user_email', data.user.email || '');
                localStorage.setItem('user_role', role || '');
                localStorage.setItem('clinic_id', data.user.clinic_id || '');
                localStorage.setItem(
                    'requires_clinic_setup',
                    data.requires_clinic_setup ? 'true' : 'false',
                );
            }

            if (role === 'asisten' || !role) {
                setIsForbidden(true);
                return;
            }

            fillClinicForm(data.clinic);
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateErrorMessage(error.message)
                    : 'Tidak dapat memeriksa akses. Silakan coba lagi.';

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
    }, []);

    const validateForm = () => {
        if (!clinicName.trim()) {
            return 'Nama klinik wajib diisi.';
        }

        if (!sipbNumber.trim()) {
            return 'Nomor praktek / SIPB wajib diisi.';
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

        if (currentRole !== 'midwife') {
            await Swal.fire({
                title: 'Tidak Perlu Daftar Klinik',
                text: 'Admin dapat mengakses halaman ini sebagai developer, tetapi pendaftaran klinik dilakukan oleh akun bidan.',
                icon: 'info',
                confirmButtonColor: '#739072',
            });

            return;
        }

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

            const response = await api.post(`/auth/register-clinic`, {
                clinic_name: clinicName.trim(),
                clinic_email: email.trim().toLowerCase(),
                license_number: sipbNumber.trim(),
                clinic_address: address.trim(),
                clinic_phone: phone.trim(),
            }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            const data = response.data  as RegisterClinicResponse;

            if (response.status === 401 || response.status === 422) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    data?.msg ||
                        'Anda tidak memiliki izin untuk menyimpan data klinik.',
                );
            }

            if (response.status !== 200) {
                throw new Error(data?.msg || 'Gagal menyimpan informasi klinik.');
            }

            saveSessionFromResponse(data);

            await Swal.fire({
                title: 'Berhasil',
                text:
                    data.msg ||
                    'Informasi klinik berhasil disimpan.',
                icon: 'success',
                timer: 1600,
                showConfirmButton: false,
                confirmButtonColor: '#739072',
            });

            router.push(data.redirect_path || '/dashboard');
        } catch (error) {
            const message =
                error instanceof Error
                    ? translateErrorMessage(error.message)
                    : 'Gagal menyimpan informasi klinik. Silakan coba lagi.';

            setError(message);

            await Swal.fire({
                title: 'Pendaftaran Gagal',
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
                <section className={styles.loadingCard}>
                    Memeriksa akses halaman...
                </section>
            </main>
        );
    }

    if (isForbidden) {
        return <ForbiddenView />;
    }

    if (currentRole === 'admin') {
        return (
            <DeveloperInfoView
                adminName={currentUserName}
                onGoDashboard={() => router.push('/dashboard')}
                onGoManagement={() => router.push('/management-setting')}
            />
        );
    }

    const isUpdateMode = Boolean(
        clinicName || sipbNumber || phone || email || address,
    );

    return (
        <main className={styles.page}>
            <LeftPanel />

            <section className={styles.rightPanel}>
                <div className={styles.formCard}>
                    <div className={styles.formHeader}>
                        <h2>
                            {isUpdateMode
                                ? 'Kelola Klinik'
                                : 'Pendaftaran Klinik'}
                        </h2>

                        <p>
                            {currentUserName
                                ? `Masuk sebagai bidan: ${currentUserName}`
                                : 'Masukkan informasi klinik untuk mengaktifkan sistem.'}
                        </p>
                    </div>

                    <form onSubmit={handleCreateClinic} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label>
                                Nama Klinik{' '}
                                <span className="text-red-500">*</span>
                            </label>

                            <input
                                type="text"
                                value={clinicName}
                                onChange={(event) =>
                                    setClinicName(event.target.value)
                                }
                                disabled={loading}
                                placeholder="Masukkan nama klinik"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>
                                Nomor Praktek / SIPB{' '}
                                <span className="text-red-500">*</span>
                            </label>

                            <input
                                type="text"
                                value={sipbNumber}
                                onChange={(event) =>
                                    setSipbNumber(event.target.value)
                                }
                                disabled={loading}
                                required
                                placeholder="Masukkan nomor SIPB"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>
                                Nomor Telepon{' '}
                                <span className="text-red-500">*</span>
                            </label>

                            <input
                                type="tel"
                                value={phone}
                                onChange={(event) =>
                                    setPhone(event.target.value)
                                }
                                disabled={loading}
                                required
                                placeholder="Masukkan nomor telepon"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>
                                Email Klinik{' '}
                                <span className="text-red-500">*</span>
                            </label>

                            <input
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                disabled={loading}
                                required
                                placeholder="Masukkan email klinik"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>
                                Alamat Lengkap{' '}
                                <span className="text-red-500">*</span>
                            </label>

                            <input
                                type="text"
                                value={address}
                                onChange={(event) =>
                                    setAddress(event.target.value)
                                }
                                disabled={loading}
                                required
                                placeholder="Masukkan alamat klinik"
                            />
                        </div>

                        <div className={styles.infoBox}>
                            Data klinik ini akan digunakan sebagai identitas
                            utama klinik dan akan menghubungkan akun bidan dengan
                            seluruh data operasional klinik.
                        </div>

                        {error && (
                            <div className={styles.errorBox}>{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={styles.loginButton}
                        >
                            {loading
                                ? 'Sedang Menyimpan...'
                                : isUpdateMode
                                  ? 'Update Klinik'
                                  : 'Simpan Klinik'}
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
};

export default CreateClinic;