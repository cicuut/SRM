"use client";

interface AddVisitInformationProps {
  visitNumber: string;
  data: {
    record_number?: string;
    record_type?: string;
    visit_date?: string;
    visit_time?: string;
    patient_name?: string;
  } | null;
}

const AddVisitInformation = ({ visitNumber, data }: AddVisitInformationProps) => {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#D2D8CF] bg-white px-5 py-4 shadow-sm">
        <div>
          <h1 className="text-[20px] font-bold text-[#4F6F52]">
            Tambah Kunjungan
          </h1>

          <p className="mt-1 text-[12px] text-[#6B6B6B]">
            Isi data kunjungan baru untuk laporan kunjungan klinik.
          </p>
        </div>

        <div className="rounded-[10px] bg-[#F8FAF6] px-4 py-3 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#739072]">
            Nomor Kunjungan
          </p>

          <p className="mt-1 text-[14px] font-bold text-[#2F3A2F]">
            {visitNumber || "VIS-----"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-5 ">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="flex flex-col text-sm gap-2">
            <label className="block mb-1 font-bold text-black">
              Medical Record
            </label>
            <div
              style={{ backgroundColor: "#C3C3C3" }}
              className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
            >
              {data?.record_number || "-"}
            </div>
          </div>

          <div className="flex flex-col  text-sm gap-2">
            <label className="block mb-1 font-bold text-black">
              Tipe Kunjungan
            </label>
            <div
              style={{ backgroundColor: "#C3C3C3" }}
              className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
            >
              {data?.record_type || "-"}
            </div>
          </div>

          <div className="flex flex-col  text-sm gap-2">
            <label className="block mb-1 font-bold text-black">
              Tanggal Kunjungan
            </label>
            <div
              style={{ backgroundColor: "#C3C3C3" }}
              className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
            >
              {data?.visit_date || "-"}
            </div>
          </div>

          <div className="flex flex-col  text-sm gap-2">
            <label className="block mb-1 font-bold text-black">Waktu</label>
            <div
              style={{ backgroundColor: "#C3C3C3" }}
              className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
            >
              {data?.visit_time || "-"}
            </div>
          </div>
        </div>

       
          <div className="flex flex-col text-sm gap-2">
            <label className="block mb-1 font-bold text-black">
              Nama Pasien
            </label>
            <div
              style={{ backgroundColor: "#C3C3C3" }}
              className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
            >
              {data?.patient_name || "-"}
            </div>
          </div>
        </div>
    </>
  );
};

export default AddVisitInformation;