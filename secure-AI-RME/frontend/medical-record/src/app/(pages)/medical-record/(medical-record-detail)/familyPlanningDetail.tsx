'use client';
import React from "react";
import { useState } from "react";
import FamilyInformation from "../../../../components/records/patientFamilyInformationDetail";
import ObstectricAndMedicalRecord from "@/components/records/obstetricAndMedicalHistory";
import VisitFamilyPlanningAccordition from "@/components/records/visitFamilyPlanning";
const FamilyPlanningDetail = () => {
    const [activeTab, setActiveTab] = useState('Identitas Pasien dan Keluarga');

    const tabs = [
        'Identitas Pasien dan Keluarga',
        'Riwayat Kehamilan dan Medis',
        'Hasil Pemeriksaan Kunjungan'
    ];

    return (
        <div className="min-h-screen flex flex-col bg-[#FDFEF9] w-full">
            <div className="flex border-b border-gray-200 gap-6 mt-5">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-2 text-sm font-normal transition-all cursor-pointer ${activeTab === tab
                            ? 'border-b-2 border-[#739072] text-[#739072] font-bold'
                            : 'text-[#739072]'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
            <div className="mt-6">
                {activeTab === 'Identitas Pasien dan Keluarga' && <FamilyInformation />}
                {activeTab === 'Riwayat Kehamilan dan Medis' && <ObstectricAndMedicalRecord />}
                {activeTab === 'Hasil Pemeriksaan Kunjungan' && <VisitFamilyPlanningAccordition/>}
            </div>
        </div>
    )
}
export default FamilyPlanningDetail;
