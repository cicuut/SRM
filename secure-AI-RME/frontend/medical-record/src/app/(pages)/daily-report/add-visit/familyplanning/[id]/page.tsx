"use client";
import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import api from "@/utils/app";
import AddVisitInformation from "@/components/visit/add-visit-information";
import BillingForm from "@/components/visit/billing";

const AddVisitFamilyPlanning = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const id = params.id;
  const router = useRouter();
  const [visitNumber, setVisitNumber] = useState("Generating Visit Number");
  const [weight, setWeight] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [contraceptive_method, setContraceptiveMethod] = useState("");
  const [next_visit, setNextVisit] = useState("");
  const [complaint, setComplaint] = useState("");
  const uuid = params.id;
  const [data, setData] = useState(null);
  const [total, setTotal] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
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
    setLoading(true);

    try {
      const payload = {
        visit_number: visitNumber,
        contraceptive_method: contraceptive_method,
        return_visit_date: next_visit,
        complaint: complaint,
        weight: weight,
        blood_pressure: bloodPressure,
        record_id: uuid,
        total: total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
      };
      const response = await api.post(
        "/visit-report/add-visit-family-planning",
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
        showConfirmButton: false,
        timer: 2000,
      });
      setError(errorMessage);
    }
  };
  return (
    <div className="w-full flex flex-col px-10 mt-7 ">
      <AddVisitInformation visitNumber={visitNumber} data={data} />

      <div className="border-b-2 text-[#D9D9D9] font-bold">
        {" "}
        <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">
          Tanda Vital
        </p>
      </div>
      <div className="flex-1 flex flex-row py-5 gap-6">
        <div className="flex flex-col flex-1 text-sm gap-2 max-w-[200px]">
          <label className="block mb-1 font-bold text-black">Berat</label>
          <input
            type="number"
            name="weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            id="weight"
            className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </div>
        <div className="flex flex-col flex-1 text-sm gap-2 max-w-[200px]">
          <label className="block mb-1 font-bold text-black">
            Tekanan Darah
          </label>
          <input
            type="text"
            name="bloodPressure"
            value={bloodPressure}
            onChange={(e) => setBloodPressure(e.target.value)}
            id="blood_pressure"
            className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </div>
      </div>
      <div className="border-b-2 text-[#D9D9D9] font-bold">
        {" "}
        <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">
        Catatan Kunjungan
        </p>
      </div>
      <div className="flex-1 flex flex-col py-5 gap-6">
        <div className="flex flex-row gap-x-10  w-full ">
          <div className="flex flex-col text-sm gap-2 min-w-[200px]">
            <label className="block mb-1 font-bold text-black">
              Metode Kontrasepsi
            </label>

            <select
              value={contraceptive_method}
              onChange={(e) => setContraceptiveMethod(e.target.value)}
              className="w-full h-8 p-2 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            >
              <option value="" disabled>
                Pilih
              </option>
              <option value="PIL">PIL</option>
              <option value="Suntik 1 Bulan">Suntik 1 Bulan</option>
              <option value="Suntik 3 Bulan">Suntik 3 Bulan</option>
              <option value="IUD">IUD</option>
              <option value="Inplan">Inplan</option>
            </select>
          </div>
          <div className="flex flex-col text-sm gap-2 min-w-[200px]">
            <label className="block mb-1 font-bold text-black">
              Kunjungan Selanjutnya
            </label>
            <input
              type="date"
              name="next_visit"
              value={next_visit}
              onChange={(e) => setNextVisit(e.target.value)}
              id="next_visit"
              className="w-full h-8 p-2 ounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </div>
        </div>
        <div className="flex flex-col text-sm gap-2">
          <label className="block mb-1 font-bold text-black">Keluhan</label>
          <textarea
            name="complaint"
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            id="complaint"
            className="w-full h-30 p-2 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </div>
      </div>
      <div className="flex-1 flex flex-col py-5 gap-6">
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
          Simpan Kunjungan Baru
        </button>
      </div>
    </div>
  );
};
export default AddVisitFamilyPlanning;
