"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import styles from "./signin.module.css";
import Link from "next/link";
import Swal from "sweetalert2";
import Cookies from "js-cookie";
import api from "@/utils/app";

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

const Signin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPasword] = useState("");
  const [strNumber, setStrNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password !== confirmPassword) {
      Swal.fire({
        title: "Coba Lagi",
        text: "Password tidak sama",
        icon: "warning",
        timer: 2000,
        confirmButtonColor: "#739072",
      });
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }

    try {
      const response = await api.post("/auth/register", {
        fullname: fullName,
        email: email,
        password: password,
        strnumber: strNumber,
      });

      const data = response.data;

      if (response.status === 201) {
        const userId = data.user?.id;
        Swal.fire({
          title: "Pendaftaran Sukses",
          text: "Berhasil menambahkan pengguna",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });

        if (userId) {
          Cookies.set("access_token", data.access_token, { expires: 1 });
          localStorage.setItem("temp_user_id", userId);
          router.push("/register-clinic");
        } else {
          console.error("User ID tidak ditemukan di response:", data);
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.msg || "Something went wrong";
      setError(errorMsg);
      Swal.fire({
        title: "Pendaftaran Gagal",
        text: errorMsg,
        icon: "error",
        timer: 2000,
        showConfirmButton: false,
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
            <h2>Daftar Akun Bidan</h2>
            <p>Masukan Akun Bidan</p>
          </div>
          <form onSubmit={handleRegister} className={styles.form}>
            <div className={styles.inputGroup}>
              {" "}
              <label>
                Nama Bidan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                required
                placeholder="Masukkan nama bidan"
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className={styles.inputGroup}>
              {" "}
              <label>
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                required
                placeholder="Masukan email bidan"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.inputGroup}>
              {" "}
              <label>
                Kata Sandi <span className="text-red-500">*</span>
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  required
                  placeholder="Masukkan kata sandi"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
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
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  placeholder="Masukkan ulang kata sandi"
                  required
                  onChange={(e) => setConfirmPasword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                >
                  {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
                </button>
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label>
                STR Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={strNumber}
                required
                placeholder="Masukan STR Number"
                onChange={(e) => setStrNumber(e.target.value)}
              />
            </div>
            {error && <div className={styles.errorBox}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className={styles.loginButton}
            >
              {loading ? "Sedang Mendaftarkan Bidan..." : "Submit"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};
export default Signin;
