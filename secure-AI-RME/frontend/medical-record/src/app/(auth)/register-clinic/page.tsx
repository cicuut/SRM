"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Swal from "sweetalert2";
import Cookies from "js-cookie";
import styles from "./registerClinic.module.css";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

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

const CreateClinic = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [sipbNumber, setSipbNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);


    const handleUnauthorized = () => {
        Cookies.remove('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('fullname');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('clinic_id');
        router.push('/login');
    };

    const getToken = () => {
        return Cookies.get('access_token');
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
                throw new Error(data?.msg || 'Gagal mengambil data user');
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
                    ? error.message
                    : 'Cannot connect to server. Is Flask running?';

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
            return 'Nama klinik wajib diisi';
        }

        if (!sipbNumber.trim()) {
            return 'Nomor praktek / SIPB wajib diisi';
        }

        if (!phone.trim()) {
            return 'No telepon wajib diisi';
        }

        if (!email.trim()) {
            return 'Email klinik wajib diisi';
        }

        if (!email.includes('@')) {
            return 'Format email klinik tidak valid';
        }

        if (!address.trim()) {
            return 'Alamat lengkap wajib diisi';
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
                    title: 'Coba Lagi',
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
                    clinic_email: email.trim(),
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
                    ? error.message
                    : 'Cannot connect to server. Is Flask running?';

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
            <div className="container items-center justify-center bg-[#D2E3C8]">
                <p className="text-xl font-bold text-[#4F6F52]">
                    Checking clinic access...
                </p>
            </div>
        );
    } 
  

  return (
    <main className={styles.page}>
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
              Sistem yang membantu klinik mengelola data pasien, aktivitas
              layanan, rekam medis, laporan, serta operasional harian agar lebih
              rapi, aman, dan efisien.
            </p>
          </div>
        </div>
      </section>
      <section className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Pendaftaran Klinik</h2>
            <p>Masukan informasi Klinik</p>
          </div>
          <form onSubmit={handleCreateClinic} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>
                Nama Klinik<span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                value={clinicName}
                onChange={(event) => setClinicName(event.target.value)}
                disabled={loading}
                placeholder="Masukkan nama klinik"
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label>
                Nomor Praktek / SIPB<span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                value={sipbNumber}
                onChange={(event) => setSipbNumber(event.target.value)}
                disabled={loading}
                required
                placeholder="masukan nomor SIPB"
              />
            </div>

            <div className={styles.inputGroup}>
              <h3>
                No Telepon<span className="text-red-500">*</span>
              </h3>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={loading}
                required
                placeholder="Masukan nomor telepon"
              />
            </div>

            <div className={styles.inputGroup}>
              <h3>
                Email<span className="text-red-500">*</span>
              </h3>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                required
                placeholder="Masukan email klinik"
              />
            </div>

            <div className={styles.inputGroup}>
              <h3>
                Alamat Lengkap<span className="text-red-500">*</span>
              </h3>

              <input
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                disabled={loading}
                required
                placeholder="Masukan alamat klinik"
              />
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className={styles.loginButton}
            >
              {loading ? "Sedang Mendaftarkan Klinik" : "Submit"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default CreateClinic;
