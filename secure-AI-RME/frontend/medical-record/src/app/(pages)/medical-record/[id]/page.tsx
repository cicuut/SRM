'use client'
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Cookies from 'js-cookie';
import PregnancyDetail from '@/app/(pages)/medical-record/(medical-record-detail)/pregnancyDetail';
import { Cookie } from 'next/font/google';
import FamilyPlanningDetail from '@/app/(pages)/medical-record/(medical-record-detail)/familyPlanningDetail'
import ImmunizationDetail from '@/app/(pages)/medical-record/(medical-record-detail)/immunizationDetail';
import DeliveryDetail from '@/app/(pages)/medical-record/(medical-record-detail)/deliveryDetail';
import GeneralDetail from '../(medical-record-detail)/generalDetail';
import api from "@/utils/app";

export default function MedicalRecordDetailPage() {
    const params = useParams();
    const id = params.id;
    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const respons = await api.get(`/medical-record/get-record/${id}`);
                if (respons.status === 2000) {
                    const data = respons.data();
                    setRecord(data);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchDetail();
    }, [id]);
    const renderSpecificUI = () => {
        if (!record) return null;

        switch (record.record_type) {
            case 'Kehamilan':
                return <PregnancyDetail {...record.details} />;
            case 'Keluarga Berencana':
                return <FamilyPlanningDetail {...record.details} />;
            case 'Imunisasi':
                return <ImmunizationDetail {...record.details} />;
            case 'Persalinan':
                return <DeliveryDetail {...record.details} />;
            case 'Umum':
                return <GeneralDetail {...record.details} />;
            default:
                return <div className="p-4">Tipe rekam medis tidak dikenali.</div>;
        }
    };

    if (loading) {
        return <div className="max-w-5xl mx-auto p-6">Loading...</div>;
    }

    if (!record) {
        return <div className="max-w-5xl mx-auto p-6">Rekam medis tidak ditemukan.</div>;
    }

    return (
        <div className="w-full ml-10 mx-auto p-6">
            <div>
                <h2 className="text-3xl font-bold text-[#4F6F52]">{record.record_number}</h2>
            </div>

            <div className="">
                {renderSpecificUI()}
            </div>
        </div>
    );
}