'use client';
import React from "react";
import { useState } from "react";
import { emit } from "process";
import Sidebar from "@/components/sidebar";
import PatientInformationDetail from "./patientInformationDetail";
const FamilyPlanningDetail = () => {


    return (
        <div className="min-h-screen mt-10 flex bg-[#FDFEF9] w-full">
            <PatientInformationDetail />
        </div>
    )

}
export default FamilyPlanningDetail;
