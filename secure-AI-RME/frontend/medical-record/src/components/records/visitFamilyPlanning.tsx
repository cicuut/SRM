"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import { ChevronDown } from "lucide-react";
import api from "@/utils/app";

interface VisitFamilyPlanningAccorditionList {
  visit_id?: string;
  visit_date?: string;
  weight?: string;
  blood_pressure?: string;
  contraceptive_method?: string;
  follow_up_visit?: string;
  complaints?: string;
}

const VisitFamilyPlanningAccordition = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;
  const [visitFamilyPlanning, setVisitFamilyPlanning] = useState<
    VisitFamilyPlanningAccorditionList[]
  >([]);

  useEffect(() => {
    const visitDate = async () => {
      if (!uuid) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await api.get(
          `/medical-record/get-family-planning-visit-data/${uuid}`,
        );

        const data = response.data;
        const actualData = data || [];
        setError("");
        setVisitFamilyPlanning(actualData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    visitDate();
  }, [uuid]);

  if (loading)
    return (
      <div className="p-8 text-center text-[#739072] animate-pulse">
        Sedang mengambil data medis...
      </div>
    );
  if (error)
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Error: {error}
      </div>
    );
  return (
    <div className="w-full">
      {visitFamilyPlanning && visitFamilyPlanning.length > 0 ? (
        visitFamilyPlanning.map((visitFamilyPlanning) => (
          <Accordion
            key={visitFamilyPlanning.visit_id}
            disableGutters
            elevation={2}
            sx={{
              margin: "1.5em 0px",
              borderRadius: "5px !important",
              "&:before": {
                display: "none",
              },
              overflow: "hidden",
              border: "1px solid #e5e7eb",
            }}
          >
            <AccordionSummary
              expandIcon={
                <ChevronDown className="text-[#739072] text-[15px]" />
              }
              aria-controls={`panel-${visitFamilyPlanning.visit_id}-content`}
              id={`panel-${visitFamilyPlanning.visit_id}-header`}
              sx={{
                backgroundColor: "white",
                flexDirection: "row-reverse",
                borderRadius: "12px !important",
                "& .MuiAccordionSummary-expandIconWrapper": {
                  marginRight: "16px",
                },
                "& .MuiAccordionSummary-content": {
                  marginLeft: "0px",
                },
              }}
            >
              <div className="flex items-center gap-4">
                <p className="font-bold text-[#4F6F52] text-[15px]">
                  {visitFamilyPlanning.visit_date}
                </p>
              </div>
            </AccordionSummary>
            <AccordionDetails
              sx={{ borderTop: "1px solid #e5e7eb", padding: "20px" }}
            >
              <div className="flex flex-col gap-2">
                <table w-full>
                  <tbody>
                    <tr>
                      <td className="w-[25%]">Berat</td>
                      <td className="w-[2%]"> : </td>
                      <td>{visitFamilyPlanning.weight} kg</td>
                    </tr>
                    <tr>
                      <td>Tekanan Darah</td>
                      <td> : </td>
                      <td>{visitFamilyPlanning.blood_pressure}</td>
                    </tr>
                    <tr>
                      <td>Metode KB</td>
                      <td> : </td>
                      <td>{visitFamilyPlanning.contraceptive_method}</td>
                    </tr>

                    <tr>
                      <td>Kunjungan Berikutnya</td>
                      <td> : </td>
                      <td>{visitFamilyPlanning.follow_up_visit}</td>
                    </tr>
                    <tr>
                      <td>complaint</td>
                      <td colSpan={2}> : </td>
                    </tr>
                  </tbody>
                </table>
                <div className="min-h-10 p-2 overflow-y-auto text-wrap rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                  {visitFamilyPlanning.complaints}
                </div>
              </div>
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        <div className="text-center p-10">
          <p className="text-gray-500 font-medium">
            Belum ada riwayat kunjungan untuk pasien ini.
          </p>
        </div>
      )}
    </div>
  );
};
export default VisitFamilyPlanningAccordition;
