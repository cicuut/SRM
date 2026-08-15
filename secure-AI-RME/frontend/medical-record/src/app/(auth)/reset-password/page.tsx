"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/utils/app";
import Swal from "sweetalert2";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token"); 
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      Swal.fire("Error", "Token reset password tidak ditemukan di URL.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      Swal.fire("Peringatan", "Konfirmasi password tidak cocok!", "warning");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password", {
        token,
        new_password: newPassword,
      });

      await Swal.fire({
        title: "Berhasil!",
        text: response.data.msg,
        icon: "success",
        confirmButtonColor: "#739072",
      });

      router.push("/login"); 
    } catch (err: any) {
      Swal.fire({
        title: "Gagal!",
        text: err.response?.data?.msg || "Gagal mengubah password.",
        icon: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFEF9] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#D2D8CF] bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-[#4F6F52]">Ubah Password Baru</h2>
        <p className="mt-2 text-xs text-gray-500">
          Silakan masukkan kata sandi baru untuk akun Anda.
        </p>

        <form onSubmit={handleReset} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-bold text-gray-700">
            Password Baru
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="h-11 rounded-xl border border-gray-300 px-4 text-sm outline-none focus:border-[#739072]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-bold text-gray-700">
            Konfirmasi Password Baru
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="h-11 rounded-xl border border-gray-300 px-4 text-sm outline-none focus:border-[#739072]"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-11 rounded-full bg-[#739072] text-sm font-bold text-white transition hover:bg-[#5F785F] disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Simpan Password Baru"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFEF9] px-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-[#D2D8CF] bg-white p-8 shadow-sm text-center text-sm text-gray-500">
            Memuat halaman reset password...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}