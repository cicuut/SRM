'use client';
import React from "react";
import { useState } from "react";
import { emit } from "process";
import PatientInformationDetail from "../../../../components/records/patientInformationDetail";
import FamilyInformation from "../../../../components/records/familyInformationDetail";
import PastObstecticHistoryDetail from "@/components/records/pastObstetricHistoryDetail";
import CurrentPregnancyDetail from "@/components/records/currentPregnancyDetail";
import GeneralExainationDetail from "@/components/records/generalExaminationDetail";
const PregnancyDetail = () => {
    const [activeTab, setActiveTab] = useState('Identitas Keluarga');

    const tabs = [
        'Identitas Keluarga',
        'Riwayat Kehamilan Sebelumnya',
        'Kehamilan Saat Ini',
        'Pemeriksaan Umum',
        'Pemeriksaan Obstetri'
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
                {activeTab === 'Identitas Keluarga' && <FamilyInformation />}
                {activeTab === 'Riwayat Kehamilan Sebelumnya' && <PastObstecticHistoryDetail />}
                {activeTab === 'Kehamilan Saat Ini' && <CurrentPregnancyDetail />}
                {activeTab === 'Pemeriksaan Umum' && <GeneralExainationDetail />}
            </div>
        </div>
    )

}
export default PregnancyDetail;
