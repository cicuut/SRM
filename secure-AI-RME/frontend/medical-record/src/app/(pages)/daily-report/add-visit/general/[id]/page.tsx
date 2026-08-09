"use client";
import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import api from "@/utils/app";
import AddVisitInformation from "@/components/visit/add-visit-information";
import BillingForm from "@/components/visit/billing";

const AddVisitGeneral = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const id = params.id;
  const router = useRouter();
  const [visitNumber, setVisitNumber] = useState("Generating Visit Number");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [total, setTotal] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const uuid = params.id;
  const [data, setData] = useState(null);

  const fetchData = async () => {
    if (!uuid) return;
    try {
      const [resNum, resInfo] = await Promise.all([
        api.get(`/visit-report/visit-number`),
        api.get(`/visit-report/get-visit-information?uuid=${uuid}`),
      ]);
      setVisitNumber(resNum.data.visit_number);
      setData(resInfo.data);
    } catch (err) {
      console.error("Fetch error:", err);
      setVisitNumber("Gagal generate nomor");
    }
  };

  useEffect(() => {
    fetchData();
  }, [uuid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedPaymentStatus = paymentStatus.trim().toLowerCase();

    if (!['paid', 'unpaid'].includes(normalizedPaymentStatus)) {
      await Swal.fire({
        title: "Status Pembayaran Wajib Dipilih!",
        text: "Pilih status Terbayar atau Belum Bayar sebelum menyimpan kunjungan.",
        icon: "warning",
        confirmButtonColor: "#739072",
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        visit_number: visitNumber,
        subjective: subjective,
        objective: objective,
        assessment: assessment,
        plan: plan,
        record_id: uuid,
        total: total,
        payment_method: paymentMethod,
        payment_status: normalizedPaymentStatus,
      };
      const response = await api.post(
        "/visit-report/add-visit-general",
        payload,
      );
      if (response.status === 201) {
        Swal.fire({
          title: "Success",
          text: "Data Kunjungan berhasil disimpan!",
          icon: "success",
          showConfirmButton: false,
          timer: 2000,
        });
      }
      router.push("/daily-report");
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      const errorMessage = err.response?.data?.msg || "Something went wrong";
      Swal.fire({
        title: "Gagal Menyimpan!",
        text: errorMessage,
        icon: "error",
        confirmButtonColor: "#739072",
      });
      setError(errorMessage);
    }
  };
  return (
    <div className="relative flex w-full min-w-0 flex-col gap-4">
      <AddVisitInformation visitNumber={visitNumber} data={data} />
      <div className="border-b-2 text-[#D9D9D9] font-bold">
        <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">
          SOAP
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 px-5">
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">Subjective</p>
          <textarea
            name="subjective"
            value={subjective}
            onChange={(e) => setSubjective(e.target.value)}
            id="subjective"
             className="w-full p-2 h-30 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">Objective</p>
          <textarea
            name="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            id="objective"
            className="w-full p-2 h-30 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">Assessment</p>
          <textarea
            name="assessment"
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            id="assessment"
             className="w-full p-2 h-30 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">Plan</p>
          <textarea
            name="plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            id="plan"
             className="w-full p-2 h-30 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
      </div>
      <div className="flex-1 flex flex-col pt-5 gap-6">
        <BillingForm
          total={total}
          setTotal={setTotal}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentStatus={paymentStatus}
          setPaymentStatus={setPaymentStatus}
        />
      </div>
      <div className="flex justify-center gap-4 mt-10">
         <button
          onClick={handleSubmit}
          type="submit"
          className="px-8 py-2 bg-[#739072] text-white rounded-full hover:bg-[#4F6F52] shadow-lg transition font-bold cursor-pointer"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="spinner"></div>
              <span>Memproses...</span>
            </div>
          ) : (
            "Simpan Kunjungan Baru"
          )}
        </button>
      </div>
    </div>
  );
};
export default AddVisitGeneral;