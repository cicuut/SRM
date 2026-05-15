"use client";
import { useEffect } from "react";
import { useState } from "react";
import { useParams } from "next/dist/client/components/navigation";
import VisitInformation from "@/components/visit/visit-information";
import api from "@/utils/app";

// Data shape for immunization visit details
interface VisitImmunizationDetailProps {
  weight_kg?: string;
  height_cm?: string;
  vaccine_given?: string;
  dosage_given?: string;
  body_temperature?: string;
  head_circumference?: string;
  abdominal_circumference?: string;
}
const VisitImmunizationDetail = () => {
  // Local state for visit details and loading/error status
  const [visitImmunizationDetail, setVisitImmunizationDetail] =
    useState<VisitImmunizationDetailProps | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;

  // Fetch visit details when the page loads or ID changes
  useEffect(() => {
    const fetchVisitImmunizationData = async () => {
      if (!uuid) return;
      try {
        const response = await api.get(
          `/visit-report/get-visit-immunization/${uuid}`,
        );
        const data = response.data;
        setVisitImmunizationDetail(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVisitImmunizationData();
  }, [uuid]);
  if (loading)
    return (
      <div className="p-8 text-center text-[#739072] animate-pulse">
        Sedang mengambil data medis...
      </div>
    );
  if (error)
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  return (
    <div className="min-h-screen mt-10 flex flex-col bg-[#FDFEF9] w-full">
      <VisitInformation />
      <div className="flex border-b border-gray-200 gap-6 mt-10">
        <p className="border-b-2 border-[#739072] text-[#739072] font-bold">
          Catatan Medis
        </p>
      </div>
      {/* Display family planning visit details */}
      <div className=" flex flex-row py-5 gap-6">
         <table className="w-full">
          <tbody>
            <tr>
              <td className="w-[13%]">Berat</td>
              <td className="w-[2%]">:</td>
              <td>{visitImmunizationDetail?.weight_kg} kg</td>
            </tr>
            <tr>
              <td>Tekanan Darah</td>
              <td>:</td>
              <td>{visitImmunizationDetail?.height_cm} cm</td>
            </tr>
             <tr>
              <td>Suhu Tubuh</td>
              <td>:</td>
              <td>{visitImmunizationDetail?.body_temperature} °C</td>
            </tr>
             <tr>
              <td>Lingkar Kepala</td>
              <td>:</td>
              <td>{visitImmunizationDetail?.head_circumference} cm</td>
            </tr>
             <tr>
              <td>Lingkar Perut</td>
              <td>:</td>
              <td>{visitImmunizationDetail?.abdominal_circumference} cm</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-row text-sm gap-2">
        <div className="flex flex-col text-sm gap-2 min-w-[200px]">
          <label className="block mb-1 font-bold text-black">Imunisasi</label>
          <div className="w-full  p-2 rounded-md  overflow-y-auto text-wrap bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitImmunizationDetail?.vaccine_given}
          </div>
        </div>
        <div className="flex flex-col text-sm gap-2 min-w-[200px]">
          <label className="block mb-1 font-bold text-black">Dosis</label>
          <div className="w-full  p-2 rounded-md  overflow-y-auto text-wrap bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
            {visitImmunizationDetail?.dosage_given}
          </div>
        </div>
      </div>
    </div>
  );
};
export default VisitImmunizationDetail;
