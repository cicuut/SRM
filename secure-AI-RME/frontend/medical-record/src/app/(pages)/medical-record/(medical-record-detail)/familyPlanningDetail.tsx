'use client';
import React from "react";
import { useState } from "react";
import { emit } from "process";
import Sidebar from "@/components/sidebar";
import PatientInformationDetail from "../../../../components/records/patientInformationDetail";
import FamilyInformation from "../../../../components/records/familyInformationDetail";
import ObstectricAndMedicalRecord from "@/components/records/obstetricAndMedicalHistory";
const FamilyPlanningDetail = () => {
    const [activeTab, setActiveTab] = useState('Informasi Keluarga');

    const tabs = [
        'Informasi Keluarga',
        'Riwayat Kehamilan dan Medis',
        'Hasil Pemeriksaan Kunjungan'
    ];

    return (
        <div className="min-h-screen mt-10 flex flex-col bg-[#FDFEF9] w-full">
            <PatientInformationDetail />
            <div className="flex border-b border-gray-200 gap-6 mt-10">
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
                {activeTab === 'Informasi Keluarga' && <FamilyInformation />}
                {activeTab === 'Riwayat Kehamilan dan Medis' && <ObstectricAndMedicalRecord />}
            </div>
        </div>
    )
}
export default FamilyPlanningDetail;
