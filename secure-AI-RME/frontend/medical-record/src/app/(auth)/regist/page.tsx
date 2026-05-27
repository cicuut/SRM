'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';
import styles from './signin.module.css';
import api from '@/utils/app';

type UserRole = 'admin' | 'midwife' | 'asisten' | string;

type MeResponse = {
  msg?: string;
  requires_clinic_setup?: boolean;
  redirect_path?: string;
  user?: {
    id: string;
    fullname: string;
    email: string;
    role?: UserRole;
    user_role?: UserRole;
    clinic_id?: string | null;
    is_active?: boolean;
  };
  clinic?: {
    id: string;
    clinic_name: string;
  } | null;
};

type CreateMidwifeResponse = {
  msg?: string;
  requires_clinic_setup?: boolean;
  redirect_path?: string;
  employee?: {
    id: string;
    fullname: string;
    email: string;
    role?: UserRole;
    user_role?: UserRole;
    clinic_id?: string | null;
    is_active?: boolean;
  };
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
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
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

const normalizeRole = (role?: string | null) => {
  const normalizedRole = String(role || '').trim().toLowerCase();

  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole === 'developer') return 'admin';

  if (normalizedRole === 'midwife') return 'midwife';
  if (normalizedRole === 'bidan') return 'midwife';
  if (normalizedRole === 'owner') return 'midwife';

  if (normalizedRole === 'asisten') return 'asisten';
  if (normalizedRole === 'assistant') return 'asisten';
  if (normalizedRole === 'staff') return 'asisten';

  return normalizedRole;
};

const translateErrorMessage = (message?: string) => {
  const normalized = String(message || '').toLowerCase();

  if (normalized.includes('email sudah digunakan')) {
    return 'Email sudah digunakan.';
  }

  if (normalized.includes('email is taken')) {
    return 'Email sudah digunakan.';
  }

  if (normalized.includes('nomor str sudah digunakan')) {
    return 'Nomor STR sudah digunakan.';
  }

  if (normalized.includes('str number is taken')) {
    return 'Nomor STR sudah digunakan.';
  }

  if (normalized.includes('password minimal')) {
    return 'Password minimal 8 karakter.';
  }

  if (normalized.includes('password must be at least')) {
    return 'Password minimal 8 karakter.';
  }

  if (normalized.includes('hanya admin')) {
    return 'Hanya admin yang dapat membuat akun bidan.';
  }

  if (normalized.includes('only admin')) {
    return 'Hanya admin yang dapat membuat akun bidan.';
  }

  if (normalized.includes('akun anda sedang tidak aktif')) {
    return 'Akun Anda sedang tidak aktif.';
  }

  if (normalized.includes('inactive')) {
    return 'Akun Anda sedang tidak aktif.';
  }

  if (normalized.includes('network error')) {
    return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
  }

  if (normalized.includes('failed to fetch')) {
    return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.';
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

const ForbiddenView = () => {
  return (
    <main className={styles.forbiddenPage}>
      <section className={styles.forbiddenCard}>
        <div className={styles.forbiddenCode}>403</div>

        <h1>Forbidden Access</h1>

        <p>
          Kamu tidak memiliki izin untuk mengakses halaman pembuatan akun bidan.
        </p>

        <span>Halaman ini hanya dapat diakses oleh admin.</span>
      </section>
    </main>
  );
};

const Regist = () => {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [strNumber, setStrNumber] = useState('');
  const [fullName, setFullName] = useState('');

  const [currentAdminName, setCurrentAdminName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const checkAccess = async () => {
    try {
      setCheckingAccess(true);
      setIsForbidden(false);
      setError('');

      const token = getToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      const response = await api.get<MeResponse>('/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;

      if (!data.user) {
        throw new Error('Gagal memeriksa akses user.');
      }

      const role = normalizeRole(data.user.role || data.user.user_role);

      if (role !== 'admin') {
        setIsForbidden(true);
        return;
      }

      setCurrentAdminName(data.user.fullname || '');

      localStorage.setItem('user_id', data.user.id || '');
      localStorage.setItem('temp_user_id', data.user.id || '');
      localStorage.setItem('fullname', data.user.fullname || '');
      localStorage.setItem('user_email', data.user.email || '');
      localStorage.setItem('user_role', role);
      localStorage.setItem('clinic_id', data.user.clinic_id || '');
      localStorage.setItem(
        'requires_clinic_setup',
        data.requires_clinic_setup ? 'true' : 'false',
      );
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401 || status === 422) {
        handleUnauthorized();
        return;
      }

      if (status === 403) {
        setIsForbidden(true);
        return;
      }

      const message = translateErrorMessage(
        err?.response?.data?.msg || err?.message,
      );

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
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateForm = () => {
    if (!fullName.trim()) {
      return 'Nama bidan wajib diisi.';
    }

    if (!email.trim()) {
      return 'Email wajib diisi.';
    }

    if (!email.includes('@')) {
      return 'Format email tidak valid.';
    }

    if (!password) {
      return 'Kata sandi wajib diisi.';
    }

    if (password.length < 8) {
      return 'Kata sandi minimal 8 karakter.';
    }

    if (!confirmPassword) {
      return 'Konfirmasi kata sandi wajib diisi.';
    }

    if (password !== confirmPassword) {
      return 'Kata sandi dan konfirmasi kata sandi tidak sama.';
    }

    if (!strNumber.trim()) {
      return 'Nomor STR wajib diisi.';
    }

    return '';
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    const validationMessage = validateForm();

    if (validationMessage) {
      setError(validationMessage);

      await Swal.fire({
        title: 'Data Belum Lengkap',
        text: validationMessage,
        icon: 'warning',
        timer: 2200,
        confirmButtonColor: '#739072',
      });

      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = getToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      const response = await api.post<CreateMidwifeResponse>(
        '/auth/management/initial-midwife',
        {
          fullname: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          strnumber: strNumber.trim(),
          is_active: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = response.data;

      await Swal.fire({
        title: 'Berhasil',
        text:
          data.msg ||
          'Akun bidan berhasil dibuat. Bidan dapat login dan melengkapi data klinik.',
        icon: 'success',
        timer: 1800,
        showConfirmButton: false,
        confirmButtonColor: '#739072',
      });

      router.push('/management-setting');
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401 || status === 422) {
        handleUnauthorized();
        return;
      }

      if (status === 403) {
        setIsForbidden(true);
        return;
      }

      const message = translateErrorMessage(
        err?.response?.data?.msg || err?.message || 'Gagal membuat akun bidan.',
      );

      setError(message);

      await Swal.fire({
        title: 'Pendaftaran Gagal',
        text: message,
        icon: 'error',
        timer: 2400,
        showConfirmButton: false,
        confirmButtonColor: '#739072',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess) {
    return (
      <main className={styles.loadingPage}>
        <section className={styles.loadingCard}>
          Memeriksa akses admin...
        </section>
      </main>
    );
  }

  if (isForbidden) {
    return <ForbiddenView />;
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

            <h1>Tambah Akun Bidan</h1>

            <p className={styles.description}>
              Admin dapat membuat akun bidan baru. Setelah akun dibuat, bidan
              akan login sendiri dan melengkapi data klinik yang berbeda.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Daftar Akun Bidan</h2>

            <p>
              {currentAdminName
                ? `Masuk sebagai admin: ${currentAdminName}`
                : 'Halaman ini khusus untuk admin.'}
            </p>
          </div>

          <form onSubmit={handleRegister} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>
                Nama Bidan <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                value={fullName}
                required
                disabled={loading}
                placeholder="Masukkan nama bidan"
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>
                Email <span className="text-red-500">*</span>
              </label>

              <input
                type="email"
                value={email}
                required
                disabled={loading}
                placeholder="Masukkan email bidan"
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>
                Kata Sandi <span className="text-red-500">*</span>
              </label>

              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  required
                  disabled={loading}
                  placeholder="Minimal 8 karakter"
                  onChange={(event) => setPassword(event.target.value)}
                />

                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? 'Sembunyikan kata sandi'
                      : 'Tampilkan kata sandi'
                  }
                >
                  {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>
                Konfirmasi Kata Sandi <span className="text-red-500">*</span>
              </label>

              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  required
                  disabled={loading}
                  placeholder="Masukkan ulang kata sandi"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />

                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? 'Sembunyikan kata sandi'
                      : 'Tampilkan kata sandi'
                  }
                >
                  {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>
                Nomor STR <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                value={strNumber}
                required
                disabled={loading}
                placeholder="Masukkan nomor STR"
                onChange={(event) => setStrNumber(event.target.value)}
              />
            </div>

            <div className={styles.infoBox}>
              Akun bidan yang dibuat dari halaman ini belum memiliki klinik.
              Saat bidan login pertama kali, bidan akan diarahkan untuk
              melengkapi data kliniknya sendiri.
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.buttonGroup}>
              <button
                type="button"
                disabled={loading}
                className={styles.secondaryButton}
                onClick={() => router.push('/management-setting')}
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={loading}
                className={styles.loginButton}
              >
                {loading ? 'Sedang Mendaftarkan...' : 'Buat Akun Bidan'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
};

export default Regist;