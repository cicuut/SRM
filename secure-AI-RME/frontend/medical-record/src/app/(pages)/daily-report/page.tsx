"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Funnel,
  X,
  ChevronDown,
  FileDown,
  CalendarDays,
} from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import Swal from "sweetalert2";
import Cookies from "js-cookie";
import axios from "axios";
import { DateLabel } from "../dashboard/page";
import api from "@/utils/app";

interface VisitList {
  visit_id: string;
  visit_number: string;
  rm_id: string;
  record_number: string;
  record_type: string;
  patient_name: string;
  nik: string;
  visit_date: string;
  made_by: string;
}

const DailyReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [visitReportList, setVisitReportList] = useState<VisitList[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalVisitOpen, setIsModalVisitOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("Select a type");
  const router = useRouter();
  const [verificationInput, setVerificationInput] = useState("");
  const [filteredResults, setFilteredResults] = useState<VisitList[]>([]);
  const [filteredVisitResults, setFilteredVisitResults] = useState<VisitList[]>([]);
  const [visitSearch, setVisitSearch] = useState("");

  useEffect(() => {
    const fetchDailyReport = async () => {
      try {
        const response = await api.get("/visit-report/get-all-visit");
        const data = response.data;
        setVisitReportList(data);
      } catch (err: any) {
        const msg =
          err.response?.data?.msg || err.message || "Terjadi kesalahan";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchDailyReport();
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#FDFEF9]">
        <div className="flex min-h-dvh w-full max-w-full overflow-x-hidden">
          <main className="box-border flex min-w-0 flex-1 items-center justify-center overflow-x-hidden bg-[#FDFEF9] pb-[40px] pl-4 pr-0 pt-[26px] sm:pl-[28px] sm:pr-0">
            <p className="text-[14px] font-bold text-[#5F785F]">Loading...</p>
          </main>
        </div>
      </div>
    );
  }
  if (error)
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  const handleSubmitRecordType = (e: React.FormEvent) => {
    e.preventDefault();

    setIsModalOpen(false);
    setIsDropdownOpen(false);
    setSelectedType("Masukan Identitas Pasien (Nama, NIK atau Tanggal Lahir)");
    setLoading(true);
    switch (selectedType) {
      case "Rekam Medis Kehamilan":
        router.push("/medical-record/pregnancy-record?type=Kehamilan");
        break;
      case "Rekam Medis Keluarga Berencana":
        router.push(
          "/medical-record/family-planning-record?type=Keluarga Berencana",
        );
        break;
      case "Rekam Medis Poli Umum":
        router.push("/medical-record/general-record?type=Umum");
        break;
      case "Rekam Medis Bayi dan Imunisasi":
        router.push("/medical-record/immunization-record?type=Imunisasi");
        break;
      case "Rekam Medis Persalinan":
        router.push("/medical-record/delivery-record?type=Persalinan");
        break;
      default:
        Swal.fire({
          title: "Proses Gagal",
          text: "Pilih tipe rekam medis terlebih dahulu",
          icon: "error",
          confirmButtonColor: "#739072",
          timer: 2000,
        });
    }
  };

  const handleVisit = (rmId: string, type: string) => {
    const typeMap: { [key: string]: string } = {
      Kehamilan: "pregnancy",
      "Keluarga Berencana": "familyplanning",
      "Poli Umum": "general",
      Imunisasi: "immunization",
      Persalinan: "delivery",
    };
    const typePath = typeMap[type] || "general";
    router.push(`/daily-report/add-visit/${typePath}/${rmId}`);
  };

  const handleSearch = async (query: string) => {
    if (query.length < 3) return;
    try {
      const response = await api.get(
        `/medical-record/search-patients?query=${query}`,
      );
      setFilteredResults(response.data);
    } catch (err: any) {
      const msg =
        err.response?.data?.msg || err.message || "Gagal mencari pasien";
      setError(msg);
    }
  };

  const handleSearchVisit = async (query: string) => {
    if (query.length < 3) return;
    try {
      const response = await api.get(
        `/visit-report/search-visit?query=${query}`,
      );
      setFilteredVisitResults(response.data);
    } catch (err: any) {
      const msg =
        err.response?.data?.msg || err.message || "Gagal mencari pasien";
      setError(msg);
    }
  };


  const handleViewRecordDetail = (visitId: string) => {
    router.push(`/daily-report/${visitId}`);
  };

  return (
    <div>
      <div className="flex-1 flex flex-col  w-full">
        <div className="w-full flex items-center py-6 gap-70  justify-between">
          <div className="relative flex-1  outline-1 outline-gray-300 rounded-lg px-4 py-2 shadow-sm transition-all focus-within:border-[#739072]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-300" />
            <form>
              <input
                type="text"
                placeholder="Masukan Nama Pasien"
                className="w-full focus:outline-none pl-8 text-gray-700 placeholder-gray-400"
                value={visitSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setVisitSearch(val); 

                  if (val.length >= 3) {
                    handleSearchVisit (val);
                  } else {
                    setFilteredVisitResults([]); 
                  }
                }}
              />
            </form>
          </div>
          <div className=" flex flex-row items-center gap-5 shrink-0">
            <div
              onClick={() => setIsModalVisitOpen(true)}
              className="cursor-pointer flex flex-row items-center gap-x-[4]  rounded-[50px] px-5 py-2 bg-[#86A789] shadow-sm transition-all focus-within:border-[#739072]"
            >
              <Plus className="size-3" />
              <span className="font-bold">Tambah Laporan Kunjungan</span>
            </div>
          </div>
        </div>
        <div className="w-full flex felx-row gap-x-5">
          <div className="flex items-center justify-center min-w-37.5 text-center bg-[#D2E3C8] p-2  rounded-[50px] font-bold">
            <DateLabel />
          </div>
          <div className="flex items-center justify-center min-w-37.5 text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer">
            Pilih Tanggal
            <CalendarDays className="ml-2.5 size-5" />
          </div>
          <div className="flex items-center justify-center min-w-37.5 text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer">
            Filter <Funnel className="ml-2.5 size-5" />
          </div>
          <div className="flex items-center justify-center min-w-37.5 text-center border p-2 rounded-[50px] border-gray-400 cursor-pointer">
            Download <FileDown className="ml-2.5 size-5" />
          </div>
        </div>
        <div className="mt-5">
          <table className="min-w-full divide-y divide-gray-200 text-[11px]">
            <thead className="bg-[#D2E3C8] text-gray-700 font-semibold drop-shadow-lg ">
              <tr>
                <th className="px-6 py-4 border-r border-gray-200 w-40">
                  Kunjungan ID
                </th>
                <th className="px-6 py-4 border-r border-gray-200 w-50">
                  Waktu
                </th>
                <th className="px-6 py-4 border-r border-gray-200 w-50">
                  RM ID
                </th>
                <th className="px-6 py-4 border-r border-gray-200">
                  Name Pasien
                </th>
                <th className="px-6 py-4 border-r border-gray-200 w-50">
                  Tipe Kunjungan
                </th>
                <th className="px-6 py-4 border-r border-gray-200 w-40">
                  Dibuat Oleh
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
             {(visitSearch.length >= 3
                ? filteredVisitResults
                : visitReportList
              ).map((item, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 transition-colors text-gray-600 cursor-pointer"
                  onClick={() => handleViewRecordDetail(item.visit_id)}
                >
                  <td className="px-4 py-4 text-center">{item.visit_number}</td>
                  <td className="px-4 py-4 ">{item.visit_date}</td>
                  <td className="px-4 py-4 text-center">
                    {item.record_number}
                  </td>
                  <td className="px-4 py-4 ">{item.patient_name}</td>
                  <td className="px-4 py-4 text-center">{item.record_type}</td>
                  <td className="px-6 py-4">{item.made_by}</td>
                </tr>
              ))}
               {visitSearch.length >= 3 && filteredVisitResults.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    Pasien tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {isModalVisitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="flex flex-col bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-y-auto ">
            <div className="bg-[#739072] p-4 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">Verifikasi Pasien</h2>
              <button
                onClick={() => {
                  setIsModalVisitOpen(false);
                  setVerificationInput("");
                  setFilteredResults([]);
                }}
                className="cursor-pointer hover:scale-110"
              >
                <X className="w-5" />
              </button>
            </div>

            <div className="p-8 flex flex-col gap-4 min-h-5 max-h-87.5">
              <div className="relative w-full ">
                <input
                  type="text"
                  className="w-full bg-[#eeeeee] focus:outline-none rounded-lg h-12 p-4 border focus:border-[#739072]"
                  placeholder="Masukkan Nama, NIK, atau Tanggal Lahir..."
                  value={verificationInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setVerificationInput(val);
                    if (val.length > 2) {
                      handleSearch(val);
                    } else {
                      setFilteredResults([]);
                    }
                  }}
                />
              </div>
              <div className="relative w-full">
                {filteredResults.length > 0 && (
                  <div className="z-50 w-full mt-2 bg-white border border-gray-100 shadow-xl rounded-2xl overflow-hidden overflow-y-auto  animate-in fade-in slide-in-from-top-2 duration-200 max-h-50">
                    <div className="max-h-75">
                      {filteredResults.map((patient) => (
                        <div
                          key={patient.rm_id}
                          onClick={() =>
                            handleVisit(patient.rm_id, patient.record_type)
                          }
                          className="p-4 border-b last:border-0 hover:bg-[#F0F4EF] cursor-pointer rounded-xl transition-all flex justify-between items-center group"
                        >
                          <div className="flex flex-col">
                            <p className="font-bold text-[#4F6F52] group-hover:text-[#739072] transition-colors">
                              {patient.patient_name}
                            </p>
                            <p className="text-[10px] text-gray-500 flex gap-2">
                              <span>NIK: {patient.nik}</span>
                              <span className="text-gray-300">|</span>
                              <span>RM: {patient.record_number}</span>
                            </p>
                          </div>
                          <span className="text-[9px] font-bold bg-[#E9F0E8] text-[#4F6F52] px-3 py-1 rounded-full border border-[#D2E3C8]">
                            {patient.record_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="text-sm text-center">
              <p>
                Tidak ada rekam medis?
                <span
                  onClick={() => {
                    setIsModalOpen(true);
                    setIsModalVisitOpen(false);
                  }}
                  className="text-[#739072] font-bold underline ml-1 cursor-pointer"
                >
                  Buat baru di sini
                </span>
              </p>
            </div>

            <div className="p-4  flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsModalVisitOpen(false);
                  setVerificationInput("");
                  setFilteredResults([]);
                }}
                className="px-6 py-2 border rounded-full text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="flex flex-col gap-y-6 bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 h-80 pb-8">
            <div className="bg-[#739072] p-4 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">Pilih Tipe Rekam Medis</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setIsDropdownOpen(false);
                  setSelectedType("Select a type");
                }}
                className="cursor-pointer hover:scale-110 transition"
              >
                <X className="w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitRecordType}
              className="relative w-full px-8 flex flex-col gap-6"
            >
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex flex-row items-center justify-between w-full border border-gray-300 rounded-full px-6 py-3 bg-white shadow-sm hover:bg-gray-50 transition-all text-gray-700 font-medium"
                >
                  <span>{selectedType}</span>
                  <ChevronDown
                    className={`text-gray-400 w-3 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isDropdownOpen && (
                  <ul className="absolute left-0 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-y-auto max-h-30 animate-in fade-in slide-in-from-top-2 duration-200">
                    {[
                      "Kehamilan",
                      "Keluarga Berencana",
                      "Poli Umum",
                      "Imunisasi",
                      "Persalinan",
                    ].map((item) => (
                      <li
                        key={item}
                        onClick={() => {
                          setSelectedType("Rekam Medis " + item);
                          setIsDropdownOpen(false);
                        }}
                        className="px-4 py-3 hover:bg-[#D2E3C8] hover:text-[#4F6F52] cursor-pointer transition-colors text-sm border-b last:border-0 border-gray-50"
                      >
                        Rekam Medis {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsDropdownOpen(false);
                    setSelectedType("Select a type");
                  }}
                  className="px-8 py-2 border border-gray-300 rounded-full hover:bg-gray-100 transition font-medium text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-2 bg-[#739072] text-white rounded-full hover:bg-[#4F6F52] shadow-lg transition font-bold"
                >
                  Pilih Rekam Medis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReport;
