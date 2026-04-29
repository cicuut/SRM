'use client'
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Cookies from 'js-cookie';
import VisitPregnancyDetail from '../visit-detail/pregnancyDetail';
import VisitFamilyPlanningDetail from '../visit-detail/familyPlanningDetail';
import VisitImmunizationDetail from '../visit-detail/immunizationDetail';
import VisitGeneralDetail from '../visit-detail/generalDetail';

export default function VisitDetailPage() {
    const params = useParams();
    const id = params.id;

    const [visit, setVisit] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const token = Cookies.get('access_token');
                const res = await fetch(`http://localhost:5000/api/visit-report/get-visit-report/${id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    setVisit(data);
                }
            } catch (err) {
                console.error("Gagal ambil detail:", err);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchDetail();
    }, [id]);
    const renderSpecificUI = () => {
        if (!visit) return null;

        switch (visit.visit_type) {
            case 'Kehamilan':
                return <VisitPregnancyDetail {...visit.details} />;
            case 'Keluarga Berencana':
                return <VisitFamilyPlanningDetail {...visit.details} />;
            case 'Imunisasi':
                return <VisitImmunizationDetail {...visit.details} />;
            case 'Umum':
                return <VisitGeneralDetail {...visit.details} />;
            default:
                return <div className="p-4">Tipe rekam medis tidak dikenali.</div>;
        }
    };

    if (loading) {
        return <div className="max-w-5xl mx-auto p-6">Loading...</div>;
    }

    if (!visit) {
        return <div className="max-w-5xl mx-auto p-6">Rekam medis tidak ditemukan.</div>;
    }

    return (
        <div className="w-full ml-10 mx-auto p-6">
            <div>
                <h2 className="text-3xl font-bold text-[#4F6F52]">{visit.visit_number}</h2>
            </div>

            <div className="">
                {renderSpecificUI()}
            </div>
        </div>
    );
}