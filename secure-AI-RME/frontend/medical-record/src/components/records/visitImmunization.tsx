'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from 'js-cookie';
import { useParams } from "next/navigation";
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import { ChevronDown } from 'lucide-react';
import api from "@/utils/app"

interface VisitImmunizationAccorditionList {
    visit_id?: string;
    visit_date?: string;
    height?: string;
    weight?: string;
    body_temperature?: string;
    head_circumference?: string;
    abdominal_circumference?: string;
    vaccine?: string;
    dosage?: string;
}

const VisitImmunizationAccordition = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const params = useParams();
    const uuid = params.id;
    const [visitImmunization, setVisitImmunization] = useState<VisitImmunizationAccorditionList[]>([]);


    useEffect(() => {
        const visitDate = async () => {
            if (!uuid) return;
            try {
                const response = await api.get(`/medical-record/get-immunization-visit-data/${uuid}`);
                const data = response.data();
                setVisitImmunization(data);
            } catch (err: any) {
            const msg = err.response?.data?.msg || err.message || "Terjadi kesalahan";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };
        visitDate();
    }, [uuid]);

    if (loading) return <div className="p-8 text-center text-blue-600 animate-pulse">Sedang mengambil data medis...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    return (
        <div className="w-full">
            {visitImmunization.map((visitImmunization) => (
                <Accordion key={visitImmunization.visit_id} disableGutters
                    elevation={2}
                    sx={{
                         margin: "1.5em 0px", 
                        borderRadius: '5px !important', 
                        '&:before': {
                            display: 'none', 
                        },
                        overflow: 'hidden', 
                        border: '1px solid #e5e7eb' 
                    }}>
                    <AccordionSummary
                        expandIcon={<ChevronDown className="text-[#739072] text-[15px]" />}
                        aria-controls={`panel-${visitImmunization.visit_id}-content`}
                        id={`panel-${visitImmunization.visit_id}-header`}
                        sx={{
                            backgroundColor: 'white',
                            flexDirection: 'row-reverse',
                            borderRadius: '12px !important',
                            '& .MuiAccordionSummary-expandIconWrapper': {
                                marginRight: '16px',
                            },
                            '& .MuiAccordionSummary-content': {
                                marginLeft: '0px',
                            }
                        }}                    >
                        <div className="flex items-center gap-4">
                            <p className="font-bold text-[#4F6F52] text-[15px]">{visitImmunization.visit_date}</p>
                        </div>
                    </AccordionSummary>
                    <AccordionDetails sx={{ borderTop: '1px solid #e5e7eb', padding: '20px' }}>
                        <div className="flex flex-col gap-5">

                            <table w-full>
                                <tbody>
                                    <tr>
                                        <td className="w-[15%]">Berat</td>
                                        <td className="w-[2%]"> : </td>
                                        <td>{visitImmunization.weight} kg</td>
                                    </tr>
                                    <tr>
                                        <td>Tinggi</td>
                                        <td> : </td>
                                        <td>{visitImmunization.height} cm</td>
                                    </tr>
                                    <tr>
                                        <td>Suhu Tubuh</td>
                                        <td> : </td>
                                        <td>{visitImmunization.body_temperature} °C</td>
                                    </tr>

                                    <tr>
                                        <td>Lingkar Kepala</td>
                                        <td> : </td>
                                        <td>{visitImmunization.head_circumference} cm</td>
                                    </tr>
                                    <tr>
                                        <td>Lingkar Perut</td>
                                        <td> : </td>
                                        <td>{visitImmunization.abdominal_circumference} cm</td>
                                    </tr>
                                    <tr>
                                        <td>Vaksin</td>
                                        <td> : </td>
                                        <td>{visitImmunization.vaccine}</td>
                                    </tr>
                                    <tr>
                                        <td>Dosis</td>
                                        <td> : </td>
                                        <td>{visitImmunization.dosage}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </AccordionDetails>
                </Accordion>
            ))}
        </div>

    )

}
export default VisitImmunizationAccordition;
