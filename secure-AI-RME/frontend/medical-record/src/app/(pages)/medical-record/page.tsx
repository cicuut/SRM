"use client";
import { useState, useEffect } from "react";
import { useRouter } from "nextjs-toploader/app";
import Swal from "sweetalert2";
import {
  Plus,
  Search,
  X,
  ChevronDown,
  FileDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import api from "@/utils/app";
import RMTypeFilter from "@/components/rm_type";
import LoadingOverlay from "@/components/loading";
import { handleExportXlsxData, DynamicVisitRow } from "@/utils/export-delivery";
import DateRangeFilter from "@/components/date_range";

// Interface for medical record data
interface MedicalRecordList {
  rm_id: string;
  record_number: string;
  record_type: string;
  patient_name: string;
  nik: string;
  birth_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  patient_number?: string;
  address?: string;
}


type Role = 'admin' | 'midwife' | 'asisten' | '';

const normalizeRole = (role?: string | null): Role => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole === 'developer') return 'admin';
  if (normalizedRole === 'midwife') return 'midwife';
  if (normalizedRole === 'bidan') return 'midwife';
  if (normalizedRole === 'owner') return 'midwife';
  if (normalizedRole === 'asisten') return 'asisten';
  if (normalizedRole === 'assistant') return 'asisten';
  if (normalizedRole === 'staff') return 'asisten';
  return normalizedRole as Role;
};



// Main component for medical records page
const MedicalRecord = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>('');
  const [medicalRecordList, setMedicalRecordList] = useState<
    MedicalRecordList[]
  >([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("Select a type");
  const [filteredResults, setFilteredResults] = useState<MedicalRecordList[]>(
    [],
  );
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);
  const [startDate, endDate] = dateRange;
  const [medicalSearch, setMedicalSearch] = useState("");
  const [selectedRMValue, setSelectedRMValue] = useState("Select a type");
  const [selectedRMLabel, setSelectedRMLabel] = useState("Tipe RM");
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalDataList =
    medicalSearch.length >= 3 ? filteredResults : medicalRecordList;

  const totalPages = Math.ceil(totalDataList.length / itemsPerPage);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  const currentItems = totalDataList.slice(indexOfFirstItem, indexOfLastItem);

  const formatDateToString = (date: Date | null): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const storedRole = normalizeRole(localStorage.getItem('user_role'));
    setCurrentRole(storedRole);

    const fetchMedicalRecord = async () => {
      try {
        const response = await api.get("/medical-record/get-all-records");
        const data = response.data;
        setMedicalRecordList(data);
      } catch (err: any) {
        const msg =
          err.response?.data?.msg || err.message || "Terjadi kesalahan";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchMedicalRecord();
  }, []);

  if (error)
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  const handleSubmitRecordType = (e: React.FormEvent) => {
    e.preventDefault();

    setIsModalOpen(false);
    setIsDropdownOpen(false);
    setSelectedType("Select a type");
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
      case "Rekam Medis Imunisasi":
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

  const handleViewRecordDetail = (rmId: string) => {
    router.push(`/medical-record/${rmId}`);
  };
  const handleFilterDate = (start: Date | null, end: Date | null) => {
    setDateRange([start, end]);
  };

  const handleFilterChange = async (type: string, label: string) => {
    setSelectedRMValue(type);
    setSelectedRMLabel(label);
    setCurrentPage(1); // Otomatis balik ke page 1 setiap ganti filter
  };
  // Search function to search for patients based on the input query
  const handleSearch = async (query: string) => {
    if (query.length < 3) return; // Minimal 3 characters to search
    // Call the search API endpoint with the query
    try {
      const response = await api.get(
        `/medical-record/search-patients?query=${query}`,
      );
      setFilteredResults(response.data); // Update the filtered results state with the response data
    } catch (err: any) {
      // Extract error message from response or use a default message
      const msg =
        err.response?.data?.msg || err.message || "Gagal mencari pasien";
      setError(msg);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          search: medicalSearch,
          type: selectedRMValue,
          start_date: formatDateToString(startDate),
          end_date: formatDateToString(endDate),
        });

        const response = await api.get(
          `/medical-record/filter-rm-type?${params.toString()}`,
        );
        setMedicalRecordList(response.data);
        setCurrentPage(1);
      } catch (err) {
        console.error("Gagal mengambil data laporan rekam medis", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [medicalSearch, selectedRMValue, startDate, endDate]); // 👈 Semua pemicu sudah berkumpul di sini!
  const getPageNumbers = () => {
    const pageNumbers = [];

    if (totalPages <= 4) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 2) {
        pageNumbers.push(1);
        pageNumbers.push(2);
        if (currentPage === 2) pageNumbers.push(3);
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      } else if (currentPage === 3) {
        pageNumbers.push(1);
        pageNumbers.push(2);
        pageNumbers.push(3);
        pageNumbers.push(4);
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 1) {
        pageNumbers.push(1);
        pageNumbers.push("...");
        if (currentPage === totalPages - 1) pageNumbers.push(totalPages - 2);
        pageNumbers.push(totalPages - 1);
        pageNumbers.push(totalPages);
      } else if (currentPage === totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push("...");
        pageNumbers.push(totalPages - 3);
        pageNumbers.push(totalPages - 2);
        pageNumbers.push(totalPages - 1);
        pageNumbers.push(totalPages);
      } else {
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

  const canDownloadReport = currentRole === 'admin' || currentRole === 'midwife';

  const handleDownloadExcelReport = async () => {
    if (!canDownloadReport) return;

    try {
      setLoading(true);
      const formattedStart = formatDateToString(startDate);
      const formattedEnd = formatDateToString(endDate);

      const response = await api.get("/medical-record/json-delivery-record", {
        params: {
          start_date: formattedStart,
          end_date: formattedEnd,
          search: medicalSearch,
        },
      });
      
      const fetchedExcelData: DynamicVisitRow[] = response.data.results;
      await handleExportXlsxData(
        fetchedExcelData,
        formattedStart,
        formattedEnd,
      );
      Swal.fire({
        title: "Ekspor Berhasil",
        text: "Berkas laporan persalinan berhasil diunduh.",
        icon: "success",
        confirmButtonColor: "#739072",
        timer: 2000,
      });
    } catch (err) {
      console.error("Gagal memproses unduhan Excel berkas laporan", err);
      Swal.fire({
        title: "Ekspor Gagal",
        text: "Terjadi gangguan saat menyusun berkas laporan excel",
        icon: "error",
        confirmButtonColor: "#739072",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex-1 flex flex-col  w-full  gap-5">
                {loading && <LoadingOverlay />}

        <section className="w-full rounded-[22px] border border-[#D2D8CF] bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1 rounded-[50px] border border-[#D2D8CF] bg-[#FDFEF9] px-5 py-2.5 md:py-3 shadow-sm transition-all focus-within:border-[#739072] xl:max-w-170">
              <Search className="absolute left-5 top-1/2 w-3.5 md:w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={medicalSearch}
                placeholder="Masukan identitas pasien"
                onChange={(e) => {
                  const val = e.target.value;
                  setMedicalSearch(val);

                  if (val.length >= 3) {
                    handleSearch(val);
                  } else {
                    setFilteredResults([]);
                  }
                }}
                className="w-full bg-transparent pl-8 text-[10px] md:text-[13px] text-gray-700 outline-none placeholder-gray-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-1 md:grid-cols-2 sm:items-center sm:justify-between">
              <div className="relative block  ">
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
        {/* Medical records table */}
        <section className="min-h-150 w-full overflow-hidden rounded-[22px] border border-[#D2D8CF] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#E4E8E1] px-5 py-5 lg:flex-row lg:items-center lg:justify-between sm:px-6.5">
            <div className="min-w-0">
              <h2 className="text-[20px] font-extrabold leading-none text-[#5F785F]">
                Daftar Rekam Medis
              </h2>
            </div>

            <div className="flex w-40 md:w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center gap-x-2 rounded-[50px] bg-[#86A789] px-2.25 md:px-4.5 py-2 md:py-3 text-[9px] md:text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>Tambah Rekam Medis</span>
              </button>
              {selectedRMValue === "Persalinan" && canDownloadReport && (
                <button
                  type="button"
                  onClick={handleDownloadExcelReport}
                  className="flex items-center justify-center gap-x-2 rounded-[50px] bg-[#86A789] px-2.25 md:px-4.5 py-2 md:py-3 text-[9px] md:text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#739072] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>Download</span>
                </button>
              )}
            </div>
          </div>

          <div className="block lg:hidden">
            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2">
              {currentItems.length === 0 ? (
                <div className="col-span-full rounded-[14px] border border-[#E4E8E1] bg-[#F8FAF6] px-4 py-8 text-center text-[12px] text-gray-500">
                  Pasien tidak ditemukan atau data kosong.
                </div>
              ) : (
                currentItems.map((item) => (
                  <button
                    key={item.rm_id}
                    type="button"
                    onClick={() => handleViewRecordDetail(item.rm_id)}
                    className="w-full rounded-2xl border border-[#E4E8E1] bg-white px-4 py-4 text-left shadow-sm transition-all hover:border-[#86A789] hover:bg-[#F8FAF6]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-black">
                          {item.patient_name}
                        </p>
                        <p className="mt-0.75 text-[11px] font-medium text-[#6B6B6B]">
                          No. RM: {item.record_number}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 justify-center rounded-full px-3 py-1 text-[10px] font-bold ${item.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 text-[11px]">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                          Tipe RM
                        </p>
                        <p className="mt-1 font-semibold text-black truncate">
                          {item.record_type}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                          NIK
                        </p>
                        <p className="mt-1 font-semibold text-black truncate">
                          {item.nik}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                          Tgl Lahir
                        </p>
                        <p className="mt-1 font-semibold text-black truncate">
                          {item.birth_date}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#5F785F]">
                          Diperbarui
                        </p>
                        <p className="mt-1 font-semibold text-gray-500 truncate">
                          {item.updated_at.split(" ")[0]}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="hidden w-full overflow-x-auto lg:block">
            <table className="w-full border-separate border-spacing-0 text-[12px]">
              <thead className="bg-[#FDFEF9] text-[#5F785F] uppercase text-[10px] font-bold">
                <tr className="bg-[#D2E3C8] text-gray-700">
                  <th className="px-6 py-4 text-center font-bold ">No. RM</th>
                  <th className="px-6 py-4 text-center font-bold">Tipe</th>
                  <th className="px-6 py-4 text-center font-bold">
                    Nama Pasien
                  </th>
                  <th className="px-6 py-4 text-center font-bold">NIK</th>
                  <th className="px-6 py-4 text-center font-bold">
                    Tanggal Lahir
                  </th>
                  <th className="px-6 py-4 text-center font-bold">Status</th>
                  <th className="px-6 py-4 text-center font-bold">
                    Waktu Dibuat
                  </th>
                  <th className="px-6 py-4 text-center font-bold">
                    Waktu Diperbarui
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentItems.map((item, index) => (
                  <tr
                    key={item.rm_id}
                    className={`cursor-pointer text-center text-black transition-all hover:bg-[#EEF3E9] ${
                      index % 2 === 0 ? "bg-white" : "bg-[#FBFCF8]"
                    }`}
                    onClick={() => handleViewRecordDetail(item.rm_id)}
                  >
                    <td className="px-6 py-4">{item.record_number}</td>
                    <td className="px-6 py-4">{item.record_type}</td>
                    <td className="px-6 py-4">{item.patient_name}</td>
                    <td className="px-6 py-4 text-center">{item.nik}</td>
                    <td className="px-6 py-4 text-center">{item.birth_date}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold ${item.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">{item.created_at}</td>
                    <td className="px-6 py-4">{item.updated_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {medicalSearch.length >= 3 && filteredResults.length === 0 && (
              <div className="p-10 text-center text-gray-400">
                Pasien tidak ditemukan.
              </div>
            )}
          </div>
        </section>
        <div className="flex items-center justify-between border-t px-4 py-4 sm:px-6">
          <div className="hidden sm:block">
            <p className="text-[11px] text-gray-500">
              Showing <span className="font-semibold text-black">1</span> to{" "}
              <span className="font-semibold text-black">10</span> of{" "}
              <span className="font-semibold text-black">
                {medicalRecordList.length}
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
              <span>Sebelumnya</span>
            </button>
            {getPageNumbers().map((page, index) => {
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
              <span>Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="flex flex-col gap-y-6 bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 h-100 pb-8">
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
                  <ul className="absolute left-0 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-y-auto max-h-50 animate-in fade-in slide-in-from-top-2 duration-200">
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
                  disabled={selectedType === "Select a type"}
                  className={`px-8 py-2 text-white rounded-full shadow-lg transition font-bold ${
                    selectedType === "Select a type"
                      ? "bg-gray-300 cursor-not-allowed opacity-60 shadow-none"
                      : "bg-[#739072] hover:bg-[#4F6F52]"
                  }`}
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

export default MedicalRecord;
