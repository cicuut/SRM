"use client";
import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import api from "@/utils/app";
import AddVisitInformation from "@/components/visit/add-visit-information";
import BillingForm from "@/components/visit/billing";

const AddVisitImmunization = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const id = params.id;
  const router = useRouter();
  const [visitNumber, setVisitNumber] = useState("Generating Visit Number");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [temperature, setTemperature] = useState("");
  const [headCircumference, setHeadCircumference] = useState("");
  const [abdominalCircumference, setAbdominalCircumference] = useState("");
  const [vaccine_given, setVaccineGiven] = useState("");
  const [dosage_given, setDosageGiven] = useState("");
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

  const doseOptions = {
    HBO: ["Dosis 1"],
    BCG: ["Dosis 1"],
    POLIO: ["Polio 1", "Polio 2", "Polio 3", "Polio 4"],
    DPT: ["DPT 1", "DPT 2", "DPT 3", "DPT 4"],
    PCV: ["PCV 1", "PCV 2", "PCV 3"],
    CAMPAK: ["Campak 1", "Campak 2"],
    IPV: ["IPV 1", "IPV 2"],
    ROTAVIRUS: ["Rotavirus 1", "Rotavirus 2", "Rotavirus 3"],
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        visit_number: visitNumber,
        weight_kg: weight,
        height_cm: height,
        record_id: uuid,
        vaccine_given: vaccine_given,
        body_temperature: temperature,
        head_circumference: headCircumference,
        abdominal_circumference: abdominalCircumference,
        dosage_given: dosage_given,
        total: total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
      };
      const response = await api.post(
        `/visit-report/add-visit-immunization`,
        payload,
      );

      if (response.status === 201) {
        await Swal.fire({
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
        showConfirmButton: false,
        timer: 2000,
      });
      setError(errorMessage);
    }
  };
  return (
    <div className="relative flex w-full min-w-0 flex-col gap-4">
      <AddVisitInformation visitNumber={visitNumber} data={data} />

      <div className="border-b-2 text-[#D9D9D9] font-bold">
        {" "}
        <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">
          Tanda Vital
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 px-5 md:grid-cols-3">
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">Berat</p>
          <input
            type="number"
            placeholder="Tanpa satuan"
            name="weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            id="weight"
            className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">Tinggi</p>
          <input
            type="number"
            placeholder="Tanpa satuan"
            name="height"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            id="height"
            className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">          <p className="text-md font-medium text-gray-700 md:text-sm">Suhu Tubuh</p>
          <input
            type="number"
            placeholder="Tanpa satuan"
            name="temperature"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            id="temperature"
            className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 px-5 md:grid-cols-2">
        <label className="block">          <p className="text-md font-medium text-gray-700 md:text-sm">
          Lingkar Kepala
        </p>
          <input
            type="number"
            placeholder="Tanpa satuan"
            name="head_circumference"
            value={headCircumference}
            onChange={(e) => setHeadCircumference(e.target.value)}
            id="head_circumference"
            className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
        <label className="block">          <p className="text-md font-medium text-gray-700 md:text-sm">
          Lingkar Perut
        </p>
          <input
            type="number"
            placeholder="Tanpa satuan"
            name="abdominal_circumference"
            value={abdominalCircumference}
            onChange={(e) => setAbdominalCircumference(e.target.value)}
            id="abdominal_circumference"
            className="w-full p-2 h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          />
        </label>
      </div>
      <div className="border-b-2 text-[#D9D9D9] font-bold">
        <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">
          Pemberian Imunisasi
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 px-5">
        <label className="block">            <p className="text-md font-medium text-gray-700 md:text-sm">
          Pemberian Imunisasi
        </p>

          <select
            value={vaccine_given}
            onChange={(e) => {
              setVaccineGiven(e.target.value);
              setDosageGiven("");
            }}
            className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
          >
            <option value="" disabled>
              Pilih
            </option>
            <option value="HBO">HBO</option>
            <option value="BCG">BCG</option>
            <option value="POLIO">POLIO</option>
            <option value="DPT">DPT</option>
            <option value="PCV">PCV</option>
            <option value="CAMPAK">CAMPAK</option>
            <option value="IPV">IPV</option>
            <option value="ROTAVIRUS">ROTAVIRUS</option>
          </select>
        </label>

        <label className="block">            <p className="text-md font-medium text-gray-700 md:text-sm">Dosis</p>
          <select
            value={dosage_given}
            onChange={(e) => setDosageGiven(e.target.value)}
            disabled={!vaccine_given}
            className={`w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 ${!vaccine_given ? "bg-gray-100 cursor-not-allowed" : ""}`}
          >
            <option value="">Pilih Dosis</option>
            {vaccine_given &&
              doseOptions[vaccine_given as keyof typeof doseOptions]?.map(
                (dose) => (
                  <option key={dose} value={dose}>
                    {dose}
                  </option>
                ),
              )}
          </select>
        </label>
      </div>
      <div className="flex-1 flex flex-col  gap-6">
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
export default AddVisitImmunization;
