"use client";
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from "js-cookie";
import { useParams } from "next/navigation";
import { ChevronRight } from 'lucide-react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import api from '@/utils/app'

interface VisitPregnancyAccorditionList {
  visit_id?: string;
  visit_date?: string;
  weight?: string;
  height?: string;
  blood_pressure?: string;
  body_temperature?: string;
  heart_rate?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  respiratory_rate?: string;
}

const VisitPregnancyAccordition = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const uuid = params?.id;
  const [visitPregnancy, setvisitPregnancy] = useState<
    VisitPregnancyAccorditionList[]
  >([]);

    useEffect(() => {
        const visitDate = async () => {
            if (!uuid) return;
            try {
                const response = await api.get(`/medical-record/get-pregnancy-visit-data/${uuid}`);
                const data = response.data;
        const actualData = data || [];

       if (actualData.length === 0) {
                setError("Belum ada kunjungan");
            } else {
                setError(""); 
                setvisitPregnancy(actualData);
            }
                
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
      <div className="p-8 text-center  text-[#739072]  animate-pulse">
        Sedang mengambil data medis...
      </div>
    );

  if (error && error !== "Belum ada kunjungan")
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  return (
    <div className="w-full">
      {visitPregnancy && visitPregnancy.length > 0 ? (
        visitPregnancy.map((visitPregnancy) => (
          <Accordion
            key={visitPregnancy.visit_id}
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
                <ChevronRight className="text-[#739072] text-[15px]" />
              }
              aria-controls={`panel-${visitPregnancy.visit_id}-content`}
              id={`panel-${visitPregnancy.visit_id}-header`}
              sx={{
                backgroundColor: "white",
                flexDirection: "row-reverse",
                borderRadius: "12px !important",
                "&.Mui-expanded .MuiAccordionSummary-expandIconWrapper": {
                  transform: "rotate(90deg)", 
                },
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
                  {visitPregnancy.visit_date}
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
                      <td>{visitPregnancy.weight} kg</td>
                    </tr>
                    <tr>
                      <td className="w-[25%]">Tinggi</td>
                      <td className="w-[2%]"> : </td>
                      <td>{visitPregnancy.height} cm</td>
                    </tr>
                    <tr>
                      <td>Suhu Tubuh</td>
                      <td> : </td>
                      <td>{visitPregnancy.body_temperature}</td>
                    </tr>
                    <tr>
                      <td>Tekanan Darah</td>
                      <td> : </td>
                      <td>{visitPregnancy.blood_pressure}</td>
                    </tr>
                    <tr>
                      <td>Detak Jantung</td>
                      <td> : </td>
                      <td>{visitPregnancy.heart_rate}</td>
                    </tr>
                    <tr>
                      <td>Frekuensi Pernapasan</td>
                      <td> : </td>
                      <td>{visitPregnancy.respiratory_rate}</td>
                    </tr>
                    <tr>
                      <td>Subjective</td>
                      <td colSpan={2}> : </td>
                    </tr>
                    <tr>
                      <td colSpan={3}>
                        <div className="min-h-10 p-2 overflow-y-auto text-wrap rounded-md bg-white  border border-gray-300 focus:outline-none focus:ring-2">
                          {visitPregnancy.subjective}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Objective</td>
                      <td colSpan={2}> : </td>
                    </tr>
                    <tr>
                      <td colSpan={3}>
                        <div className="min-h-10 p-2 overflow-y-auto text-wrap rounded-md bg-white  border border-gray-300 focus:outline-none focus:ring-2">
                          {visitPregnancy.objective}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Assessment</td>
                      <td colSpan={2}> : </td>
                    </tr>
                    <tr>
                      <td colSpan={3}>
                        <div className="min-h-10 p-2 overflow-y-auto text-wrap rounded-md bg-white  border border-gray-300 focus:outline-none focus:ring-2">
                          {visitPregnancy.assessment}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Plan</td>
                      <td colSpan={2}> : </td>
                    </tr>
                    <tr>
                      <td colSpan={3}>
                        <div className="min-h-10 p-2 overflow-y-auto text-wrap rounded-md bg-white border border-gray-300 focus:outline-none focus:ring-2">
                          {visitPregnancy.plan}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        <div className="text-center p-10" >
          <p className="text-gray-500 font-medium">
            Belum ada riwayat kunjungan untuk pasien ini.
          </p>
        </div>
      )}
    </div>
  );
};
export default VisitPregnancyAccordition;
