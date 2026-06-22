"use client";
import React from "react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import PatientInformation from "@/components/add-records/patientInformation";
import FamilyInformation from "@/components/add-records/familyInformation";
import api from "@/utils/app";

const PregnancyRecord = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [prePregnancyWeight, setPrePregnancyWeight] = useState("");
  const [prePregnancyMUAC, setPrePregnancyMUAC] = useState("");
  const [contraceptiveHistory, setContraceptiveHistory] = useState("");
  const [geneticDiseaseHistory, setGeneticDiseaseHistory] = useState("");
  const [previousPregnancy, setPreviousPregnancy] = useState("");
  const [lastMenstrualPeriod, setLastMenstrualPeriod] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [date, setDate] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [ttScreening, setTtScreening] = useState("");
  const [labResult, setLabResult] = useState("");
  const [muac, setMuac] = useState("");
  const [rmNumber, setRmNumber] = useState("Generating RM Number");
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [obstetricHistory, setObstetricHistory] = useState<any[]>([]);
  const recordType = searchParams.get("type");
  const [patientData, setPatientData] = useState({});
  const [familyData, setFamilyData] = useState({});
  const [familyAutoFillData, setFamilyAutoFillData] = useState(null);
  const handlePatientUpdate = (data: any) => setPatientData(data);
  const handleFamilyUpdate = (data: any) => setFamilyData(data);

  const fetchRmNumber = async () => {
    try {
      const response = await api.get(
        `/medical-record/rm-number?type=${recordType}`,
      );
      setRmNumber(response.data.next_rm_number);
    } catch (error) {
      console.error("Error fetching RM number:", error);
      setRmNumber("Failed to generate RM Number");
    }
  };

  useEffect(() => {
    fetchRmNumber();
  }, [recordType]);

  const handlePregnancyCountChange = (count: string) => {
    const num = parseInt(count) || 0;
    setPreviousPregnancy(count);

    const newHistory = Array.from({ length: num }, (_, i) => ({
      pregnancy_no: i + 1,
      gestational_age: "",
      delivery_mode: "",
      pregnancy_complications: "",
      delivery_complications: "",
      baby_weight: "",
      baby_height: "",
      postpartum_status: "",
      baby_complications: "",
      postpartum_complications: "",
    }));

    setObstetricHistory(newHistory);
    if (num > 0) setIsModalOpen(true);
  };

  const updateHistoryItem = (index: number, field: string, value: string) => {
    const updated = [...obstetricHistory];
    updated[index][field] = value;
    setObstetricHistory(updated);
  };

  useEffect(() => {
    if (lastMenstrualPeriod) {
      const date = new Date(lastMenstrualPeriod);
      let d = date.getDate();
      let m = date.getMonth();
      let y = date.getFullYear();

      if (m <= 2) {
        m = m + 9;
      } else {
        m = m - 3;
        y = y + 1;
      }

      d = d + 7;

      const hplDate = new Date(y, m, d);

      const finalYear = hplDate.getFullYear();
      const finalMonth = String(hplDate.getMonth() + 1).padStart(2, "0");
      const finalDay = String(hplDate.getDate()).padStart(2, "0");

      setEstimatedDate(`${finalDay}/${finalMonth}/${finalYear}`);
    }
  }, [lastMenstrualPeriod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...patientData,
        ...familyData,
        record_number: rmNumber,
        record_type: recordType,
        pre_preg_weight_kg: prePregnancyWeight,
        pre_preg_muac_cm: prePregnancyMUAC,
        contraceptive_history: contraceptiveHistory,
        family_med_history: geneticDiseaseHistory,
        pregnancy_no: previousPregnancy,
        last_menstrual_period: lastMenstrualPeriod,
        expected_due_date: estimatedDate,
        diagnosis: diagnosis,
        registration_date: date,
        height_cm: height,
        weight_kg: weight,
        tt_screening: ttScreening,
        lab_results: labResult,
        muac_cm: muac,
        obstetric_list: obstetricHistory,
      };
      const response = await api.post("/medical-record/add-pregnancy", payload);
      if (response.status === 201) {
        Swal.fire({
          title: "Success",
          text: "Rekam medis berhasil disimpan",
          icon: "success",
          showConfirmButton: false,
          timer: 9000,
        });
        fetchRmNumber();
      }
      router.push("/medical-record");
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
    <div className="relative flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#D2D8CF] bg-white px-5 py-4 shadow-sm">
        <div>
          <h1 className="text-[20px] font-bold text-[#4F6F52]">
            Tambah Rekam Medis
          </h1>

          <p className="mt-1 text-[12px] text-[#6B6B6B]">
            Isi data rekam medis baru untuk laporan keuangan klinik.
          </p>
        </div>

        <div className="rounded-[10px] bg-[#F8FAF6] px-4 py-3 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#739072]">
            Nomor Rekam Medis
          </p>

          <p className="mt-1 text-[14px] font-bold text-[#2F3A2F]">
            {rmNumber || "INV-----"}
          </p>
        </div>
      </div>

      <PatientInformation
        record_type={recordType || "Kehamilan"}
        onDataChange={handlePatientUpdate}
        onFamilyAutoFill={(data) => setFamilyAutoFillData(data)}
      />
      <FamilyInformation onDataChange={handleFamilyUpdate} autoFillData={familyAutoFillData} />
      <div className="flex flex-col gap-0">
        <h2 className="text-md text-[#4F6F52]  underline leading-none font-lexend!">
          Riwayat Obstetri Sebelumnya
        </h2>
        <hr className="mt-0"></hr>
      </div>
      <div>
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-4 col-span-full">
            <label className="block">
              <p className="text-md font-medium text-gray-700 md:text-sm">
                Berat Sebelum Kehamilan
              </p>
              <input
                type="number"
                value={prePregnancyWeight}
                placeholder="Tanpa satuan"
                onChange={(e) => setPrePregnancyWeight(e.target.value)}
                name="prePregnancyWeight"
                id="prePregnancyWeight"
                className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
              />
            </label>
            <label className="block">
              <p className="text-md font-medium text-gray-700 md:text-sm">
                Lingkar Lengan Atas Sebelum Kehamilan
              </p>
              <input
                type="number"
                value={prePregnancyMUAC}
                placeholder="Tanpa satuan"
                onChange={(e) => setPrePregnancyMUAC(e.target.value)}
                name="prePregnancyMUAC"
                id="prePregnancyMUAC"
                className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
              />
            </label>
            <label className="block">
              <p className="text-md font-medium text-gray-700 md:text-sm">
                Riwayat Kontrasepsi
              </p>
              <select
                value={contraceptiveHistory}
                onChange={(e) => setContraceptiveHistory(e.target.value)}
                className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
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
            </label>
            <label className="block">
              {" "}
              <p className="text-md font-medium text-gray-700 md:text-sm">
                Penyakit Genetik dalam Keluarga
              </p>
              <textarea
                value={geneticDiseaseHistory}
                onChange={(e) => setGeneticDiseaseHistory(e.target.value)}
                name="geneticDiseaseHistory"
                id="geneticDiseaseHistory"
                className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 col-span-full mt-2">
            <div className="flex flex-col flex-1 text-md font-medium text-gray-700">
              <p className="text-md font-medium text-gray-700 md:text-sm">
                Berapa kali hamil sebelumnya?
              </p>
              <select
                value={previousPregnancy}
                onChange={(e) => handlePregnancyCountChange(e.target.value)}
                className="mt-1 h-8 rounded-md border border-gray-300 p-1 shadow-sm bg-white focus:outline-none focus:ring-2 text-black font-normal"
              >
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {obstetricHistory.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 px-5 pb-5">
            {obstetricHistory.map((item, index) => (
              <div key={index}>
                <h3 className="font-bold text-[#739072] mb-4">
                  Kehamilan Ke-{index + 1}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <p className="text-md font-medium text-gray-700 md:text-sm">
                      Usia Kehamilan
                    </p>
                    <input
                      type="text"
                      value={item.gestational_age}
                      onChange={(e) =>
                        updateHistoryItem(
                          index,
                          "gestational_age",
                          e.target.value,
                        )
                      }
                      className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <p className="text-md font-medium text-gray-700 md:text-sm">
                      Cara Persalinan
                    </p>
                    <select
                      value={item.delivery_mode}
                      onChange={(e) =>
                        updateHistoryItem(
                          index,
                          "delivery_mode",
                          e.target.value,
                        )
                      }
                      className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
                    >
                      <option value="" disabled>
                        Pilih
                      </option>
                      <option value="spontan">Spontan</option>
                      <option value="normal">Normal</option>
                      <option value="sc">SC</option>
                    </select>
                  </label>
                  <label className="block">
                    <p className="text-md font-medium text-gray-700 md:text-sm">
                      Komplikasi Kehamilan
                    </p>
                    <textarea
                      value={item.pregnancy_complications}
                      onChange={(e) =>
                        updateHistoryItem(
                          index,
                          "pregnancy_complications",
                          e.target.value,
                        )
                      }
                      className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <p className="text-md font-medium text-gray-700 md:text-sm">
                      Komplikasi Persalinan
                    </p>
                    <textarea
                      value={item.delivery_complications}
                      onChange={(e) =>
                        updateHistoryItem(
                          index,
                          "delivery_complications",
                          e.target.value,
                        )
                      }
                      className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <p className="text-md font-medium text-gray-700 md:text-sm">
                        Berat Badan Bayi (kg)
                      </p>
                      <input
                        type="number"
                        value={item.baby_weight}
                        placeholder="Tanpa satuan"
                        onChange={(e) =>
                          updateHistoryItem(
                            index,
                            "baby_weight",
                            e.target.value,
                          )
                        }
                        className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
                      />
                    </label>
                    <label className="block">
                      <p className="text-md font-medium text-gray-700 md:text-sm">
                        Panjang Badan Bayi (cm)
                      </p>
                      <input
                        type="number"
                        placeholder="Tanpa satuan"
                        value={item.baby_height}
                        onChange={(e) =>
                          updateHistoryItem(
                            index,
                            "baby_height",
                            e.target.value,
                          )
                        }
                        className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <p className="text-md font-medium text-gray-700 md:text-sm">
                      Masa Nifas
                    </p>
                    <select
                      value={item.postpartum_status}
                      onChange={(e) =>
                        updateHistoryItem(
                          index,
                          "postpartum_status",
                          e.target.value,
                        )
                      }
                      className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
                    >
                      <option value="" disabled>
                        Pilih
                      </option>
                      <option value="normal">Normal</option>
                      <option value="komplikasi">Komplikasi</option>
                    </select>
                  </label>
                  <label className="block">
                    {" "}
                    <p className="text-md font-medium text-gray-700 md:text-sm">
                      Komplikasi Bayi
                    </p>
                    <textarea
                      value={item.baby_complications}
                      onChange={(e) =>
                        updateHistoryItem(
                          index,
                          "baby_complications",
                          e.target.value,
                        )
                      }
                      className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <p className="text-md font-medium text-gray-700 md:text-sm">
                      Komplikasi Nifas
                    </p>
                    <textarea
                      value={item.postpartum_complications}
                      onChange={(e) =>
                        updateHistoryItem(
                          index,
                          "postpartum_complications",
                          e.target.value,
                        )
                      }
                      className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0">
        <h2 className="text-md text-[#4F6F52]  underline leading-none font-lexend!">
          Kehamilan Saat Ini
        </h2>
        <hr className="mt-0"></hr>
      </div>
      <div className="grid grid-cols-1 gap-4 px-5 pb-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            Hari Pertama Haid Terakhir
            <input
              type="date"
              value={lastMenstrualPeriod}
              onChange={(e) => setLastMenstrualPeriod(e.target.value)}
              name="lastMenstrualPeriod"
              id="lastMenstrualPeriod"
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
          <label className="block">
            Tanggal Estimasi Persalinan
            <input
              value={estimatedDate}
              readOnly
              placeholder="*automated by system"
              onChange={(e) => setEstimatedDate(e.target.value)}
              name="estimatedDateOfDelivery"
              id="estimatedDateOfDelivery"
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
        </div>
        <label className="block">
          Diagnosis
          <textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            name="diagnosis"
            id="diagnosis"
            className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 p-2 focus:outline-none focus:ring-2"
          />
        </label>
      </div>
      <div className="flex flex-col gap-0">
        <h2 className="text-md text-[#4F6F52] underline leading-none font-lexend!">
          Pemeriksaan Umum
        </h2>
        <hr className="mt-0"></hr>
      </div>
      <div className="grid grid-cols-1 gap-4 px-5 pb-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Tanggal dan Hari Registrasi{" "}
            </p>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              name="registration_date"
              id="date"
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Tinggi Badan (cm)
            </p>
            <input
              type="number"
              value={height}
              placeholder="Tanpa satuan"
              onChange={(e) => setHeight(e.target.value)}
              name="height"
              id="height"
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Berat Badan (kg)
            </p>
            <input
              type="number"
              value={weight}
              placeholder="Tanpa satuan"
              onChange={(e) => setWeight(e.target.value)}
              name="weight"
              id="weight"
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">
              TT Screening
            </p>
            <select
              value={ttScreening}
              onChange={(e) => setTtScreening(e.target.value)}
              name="ttScreening"
              id="ttScreening"
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            >
              <option value="" disabled>
                {" "}
                Pilih
              </option>
              <option value="TT 0"> TT 0</option>
              <option value="TT 1"> TT 1</option>
              <option value="TT 2"> TT 2</option>
              <option value="TT 3"> TT 3</option>
              <option value="TT 4"> TT 4</option>
              <option value="TT 5"> TT 5</option>
            </select>
          </label>
          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Lingkar Lengan Atas (cm)
            </p>
            <input
              type="number"
              value={muac}
              placeholder="Tanpa satuan"
              onChange={(e) => setMuac(e.target.value)}
              name="muac"
              id="muac"
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
          <label className="block">
            <p className="text-md font-medium text-gray-700 md:text-sm">
              Hasil Lab
            </p>
            <textarea
              value={labResult}
              onChange={(e) => setLabResult(e.target.value)}
              name="laboratoryResults"
              id="laboratoryResults"
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2"
            />
          </label>
        </div>
      </div>
      <div className="flex justify-center gap-4">
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={loading}
          className="px-8 py-2 bg-[#739072] text-white rounded-full hover:bg-[#4F6F52] shadow-lg transition font-bold cursor-pointer"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="spinner"></div>
              <span>Memproses...</span>
            </div>
          ) : (
            "Simpan"
          )}
        </button>
      </div>
    </div>
  );
};

export default PregnancyRecord;
