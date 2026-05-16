"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  X,
  ChevronDown,
  FileDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import Swal from "sweetalert2";
import { DateLabel } from "../dashboard/page";
import api from "@/utils/app";
import RMTypeFilter from "@/components/rm_type";
import DateRangeFilter from "@/components/date_range";
import LoadingOverlay from "@/components/loading";

// Interface for visit list data
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

// Main component for daily report page
const DailyReport = () => {
  const router = useRouter();

  // State variables for component
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visitReportList, setVisitReportList] = useState<VisitList[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalVisitOpen, setIsModalVisitOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [verificationInput, setVerificationInput] = useState("");
  const [filteredResults, setFilteredResults] = useState<VisitList[]>([]);
  const [visitSearch, setVisitSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedRMLabel, setSelectedRMLabel] = useState("Tipe RM");
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);
  const [startDate, endDate] = dateRange;

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalDataList =
   visitSearch.length >= 3 ? filteredResults : visitReportList;

  const totalPages = Math.ceil(totalDataList.length / itemsPerPage);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const currentItems = totalDataList.slice(indexOfFirstItem, indexOfLastItem);

  // Handle form submission for record type selection
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

  // Navigate to add visit page based on record type
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

  // Search for patients by query
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

  // Search for visits by query
  const handleSearchVisit = async (query: string) => {
    if (query.length < 3) return;
    try {
      const response = await api.get(
        `/visit-report/search-visit?query=${query}`,
      );
      setFilteredResults(response.data);
    } catch (err: any) {
      const msg =
        err.response?.data?.msg || err.message || "Gagal mencari pasien";
      setError(msg);
    }
  };

  // Fetch filtered data based on search, type, and date range
  const fetchFilteredData = async () => {
    setLoading(true);
    const [start, end] = dateRange;

    const formatDate = (date: Date | null) => {
      if (!date) return "";
      return date.toISOString().split("T")[0];
    };

    try {
      const params = new URLSearchParams({
        search: visitSearch,
        type: selectedType,
        start_date: formatDate(start),
        end_date: formatDate(end),
      });

      const response = await api.get(
        `/visit-report/filter-all?${params.toString()}`,
      );
      setVisitReportList(response.data);
    } catch (err) {
      console.error("Gagal mengambil data terfilter", err);
    } finally {
      setLoading(false);
    }
  };

  // Effect to fetch data when filters change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchFilteredData();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [visitSearch, selectedType, dateRange]);

  // Handle filter change for record type
  const handleFilterChange = (type: string, label: string) => {
    setSelectedType(type);
    setSelectedRMLabel(label);
  };

  // Handle date range filter change
  const handleFilterDate = (start: Date | null, end: Date | null) => {
    setDateRange([start, end]);
  };

  // Navigate to visit detail page
  const handleViewRecordDetail = (visitId: string) => {
    router.push(`/daily-report/${visitId}`);
  };
  const getPageNumbers = () => {
    const pageNumbers = [];

    // Jika total halaman sedikit (misal <= 4), tampilkan semua tanpa titik-titik
    if (totalPages <= 4) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // 1. Jika aktif di Halaman 1 atau 2 (Awal banget)
      if (currentPage <= 2) {
        pageNumbers.push(1);
        pageNumbers.push(2);
        if (currentPage === 2) pageNumbers.push(3); // Biar user tahu ada halaman berikutnya
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      }
      // 2. Jika aktif di Halaman 3 (Mencegah elipsis aneh antara angka 1 dan 2)
      else if (currentPage === 3) {
        pageNumbers.push(1);
        pageNumbers.push(2);
        pageNumbers.push(3);
        pageNumbers.push(4);
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      }
      // 3. Jika aktif di Halaman Akhir-akhir (misal halaman 15 atau 16)
      else if (currentPage >= totalPages - 1) {
        pageNumbers.push(1);
        pageNumbers.push("...");
        if (currentPage === totalPages - 1) pageNumbers.push(totalPages - 2);
        pageNumbers.push(totalPages - 1);
        pageNumbers.push(totalPages);
      }
      // 4. Jika aktif di Halaman Batas Akhir (misal halaman 14 dari 16)
      else if (currentPage === totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push("...");
        pageNumbers.push(totalPages - 3);
        pageNumbers.push(totalPages - 2);
        pageNumbers.push(totalPages - 1);
        pageNumbers.push(totalPages);
      }
      // 5. Jika aktif di Tengah-tengah (True Middle)
      else {
        pageNumbers.push(1);
        pageNumbers.push("...");
        pageNumbers.push(currentPage - 1);
        pageNumbers.push(currentPage);
        pageNumbers.push(currentPage + 1);
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      }
    }

    return pageNumbers;
  };

  // Main render function
  return (
    <div>
      <div className="flex-1 flex flex-col  w-full  gap-5">
        {loading && <LoadingOverlay />}
        <section className="w-full rounded-[22px] border border-[#D2D8CF] bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1 rounded-[50px] border border-[#D2D8CF] bg-[#FDFEF9] px-5 py-[12px] shadow-sm transition-all focus-within:border-[#739072] xl:max-w-[680px]">
              <Search className="absolute left-5 top-1/2 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={visitSearch}
                placeholder="Masukan Nama Pasien"
                onChange={(e) => {
                  const val = e.target.value;
                  setVisitSearch(val);

                  if (val.length >= 3) {
                    handleSearchVisit(val);
                  } else {
                    setFilteredResults([]);
                  }
                }}
                className="w-full bg-transparent pl-8 text-[13px] text-gray-700 outline-none placeholder-gray-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-[10px]">
              <div className="rounded-[50px] bg-[#D2E3C8] px-[20px] py-[11px] text-center text-[12px] font-bold text-black shadow-sm">
                <DateLabel />
              </div>

              <div className="relative inline-block">
                <DateRangeFilter
                  onFilterDate={handleFilterDate}
                  selectedStartDate={startDate}
                  selectedEndDate={endDate}
                />
              </div>

              <RMTypeFilter
                onFilterChange={handleFilterChange}
                currentLabel={selectedRMLabel}
              />
            </div>
          </div>
        </section>
        <section className="w-full overflow-hidden min-h-[600px] rounded-[22px] border border-[#D2D8CF] bg-white shadow-sm">
          <div className="flex flex-col gap-[16px] border-b border-[#E4E8E1] px-5 py-[20px] lg:flex-row lg:items-center lg:justify-between sm:px-[26px]">
            <div className="min-w-0">
              <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                Daftar Kunjungan
              </h2>

            </div>

            <div className="flex w-full flex-col gap-[10px] sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:justify-end">
              <button
                type="button"
                onClick={() => setIsModalVisitOpen(true)}
                className="flex min-h-[38px] items-center justify-center gap-x-2 rounded-[50px] bg-[#86A789] px-[18px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="w-4" />
                <span>Tambah Kunjungan</span>
              </button>

              <button
                type="button"
                disabled={loading || visitReportList.length === 0}
                className="flex min-h-[38px] items-center justify-center gap-x-2 rounded-[50px] bg-[#86A789] px-[18px] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileDown className="w-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
          <div className="hidden w-full overflow-x-auto lg:block">
            <table className="w-full border-separate border-spacing-0 text-[12px]">
              <thead className="bg-[#FDFEF9] text-[#5F785F] uppercase text-[10px] font-bold">
                <tr className="bg-[#D2E3C8] text-gray-700">
                  <th className="px-6 py-4 text-center font-bold">
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
                  <th className="px-6 py-4 text-center font-bold">
                    Dibuat Oleh
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  if (currentItems.length === 0) {
                    return (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center py-20 text-gray-400"
                        >
                          <div className="flex flex-col items-center justify-center gap-2">
                            <p className="text-sm">
                              {visitSearch.length >= 3
                                ? `Kunjungan tidak ditemukan.`
                                : "Belum ada riwayat kunjungan."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return currentItems.map((item, index) => (
                    <tr
                      key={item.visit_id || index}
                      className={`cursor-pointer text-center text-black transition-all hover:bg-[#EEF3E9] ${
                        index % 2 === 0 ? "bg-white" : "bg-[#FBFCF8]"
                      }`}
                      onClick={() => handleViewRecordDetail(item.visit_id)}
                    >
                      <td className="px-4 py-4 ">{item.visit_number}</td>
                      <td className="px-4 py-4">{item.visit_date}</td>
                      <td className="px-4 py-4 ">{item.record_number}</td>
                      <td className="px-4 py-4 ">{item.patient_name}</td>
                      <td className="px-4 py-4 ">{item.record_type}</td>
                      <td className="px-6 py-4">{item.made_by}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </section>
        <div className="flex items-center justify-between border-t px-4 py-4 sm:px-6">
          <div className="hidden sm:block">
            <p className="text-[11px] text-gray-500">
              Showing <span className="font-semibold text-black">1</span> to{" "}
              <span className="font-semibold text-black">10</span> of{" "}
              <span className="font-semibold text-black">
                {visitReportList.length}
              </span>{" "}
              records
            </p>
          </div>

          <div className="flex items-center gap-x-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-x-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-[12px] font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            {getPageNumbers().map((page, index) => {
              // Jika item adalah titik-titik "...", render sebagai span biasa (tidak bisa diklik)
              if (page === "...") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 text-[12px]"
                  >
                    ...
                  </span>
                );
              }

              // Jika item adalah angka, render sebagai bubble button seperti biasa
              return (
                <button
                  key={`page-${page}`}
                  onClick={() => setCurrentPage(Number(page))}
                  className={`w-8 h-8 text-[12px] font-bold rounded-full flex items-center justify-center transition-all ${
                    currentPage === page
                      ? "bg-[#739072] text-white shadow-md scale-105" // Bubble Aktif
                      : "text-gray-600 bg-transparent hover:bg-[#EEF3E9] hover:text-[#4F6F52]" // Bubble Inaktif
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="flex items-center gap-x-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-[12px] font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      {/* Modal for adding visit */}
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
                  placeholder="Masukkan Nama, NIK, atau Tanggal Lahir"
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
      {/* Modal for selecting record type */}
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
