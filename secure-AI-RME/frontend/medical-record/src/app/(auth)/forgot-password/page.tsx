"use client";
import { useState } from "react";
import api from "@/utils/app";
import Swal from "sweetalert2";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post("/auth/forgot-password", { email });
      Swal.fire({
        title: "Email Terkirim!",
        text: response.data.msg,
        icon: "success",
        confirmButtonColor: "#739072",
      });
      setEmail("");
    } catch (err: any) {
      Swal.fire({
        title: "Gagal!",
        text: err.response?.data?.msg || "Gagal mengirim email reset password.",
        icon: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFEF9] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#D2D8CF] bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-[#4F6F52]">Lupa Password</h2>
        <p className="mt-2 text-xs text-gray-500">
          Link akan terkirim ke email yang terdaftar untuk mereset password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-bold text-gray-700">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="h-11 rounded-xl border border-gray-300 px-4 text-sm outline-none focus:border-[#739072]"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-11 rounded-full bg-[#739072] text-sm font-bold text-white transition hover:bg-[#5F785F] disabled:opacity-50"
          >
            {loading ? "Mengirim Email..." : "Kirim Link Reset"}
          </button>
        </form>
      </div>
    </div>
  );
}