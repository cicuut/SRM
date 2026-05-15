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
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={visitNumber}
          readOnly
          className="bg-transparent font-mono font-bold cursor-not-allowed focus:outline-none text-3xl text-[#4F6F52] w-full"
        />
        <p className="text-[10px] text-gray-400">*Otomatis oleh sistem</p>
      </div>

      <div className="flex-1 flex flex-col py-10 gap-6">
        <div className="flex flex-row gap-10 w-full ">
          <div className="flex flex-col flex-1 text-sm gap-2">
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

          <div className="flex flex-col flex-1 text-sm gap-2">
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

          <div className="flex flex-col flex-1 text-sm gap-2">
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

          <div className="flex flex-col flex-1 text-sm gap-2">
            <label className="block mb-1 font-bold text-black">Waktu</label>
            <div
              style={{ backgroundColor: "#C3C3C3" }}
              className="w-full p-2 border border-black-400 rounded-md text-black shadow-sm cursor-not-allowed"
            >
              {data?.visit_time || "-"}
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-col flex-1 text-sm gap-2">
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
      </div>
    </>
  );
};

export default AddVisitInformation;