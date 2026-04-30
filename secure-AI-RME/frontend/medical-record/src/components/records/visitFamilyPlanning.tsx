'use client';
import { useState, useEffect } from "react";
import Cookies from 'js-cookie';
import { useParams } from "next/navigation";
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import { ChevronDown } from 'lucide-react';


interface VisitFamilyPlanningAccorditionList {
    visit_id?: string;
    visit_date?: string
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
    const [visitFamilyPlanning, setVisitFamilyPlanning] = useState<VisitFamilyPlanningAccorditionList[]>([]);


    useEffect(() => {
        const visitDate = async () => {
            if (!uuid) return;
            try {
                const token = Cookies.get('access_token');
                const response = await fetch(`http://localhost:5000/api/medical-record/get-family-planning-visit-data/${uuid}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) throw new Error('Gagal mengambil data pasien');

                const data = await response.json();
                setVisitFamilyPlanning(data);
            } catch (err: any) {
                setError(err.message);
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
            {visitFamilyPlanning.map((visitFamilyPlanning) => (
                <Accordion key={visitFamilyPlanning.visit_id} disableGutters
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
                        aria-controls={`panel-${visitFamilyPlanning.visit_id}-content`}
                        id={`panel-${visitFamilyPlanning.visit_id}-header`}
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
                            <p className="font-bold text-[#4F6F52] text-[15px]">{visitFamilyPlanning.visit_date}</p>
                        </div>
                    </AccordionSummary>
                    <AccordionDetails sx={{ borderTop: '1px solid #e5e7eb', padding: '20px' }}>
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
                                        <td>{visitFamilyPlanning.blood_pressure} cm</td>
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
            ))}
        </div>

    )

}
export default VisitFamilyPlanningAccordition;
