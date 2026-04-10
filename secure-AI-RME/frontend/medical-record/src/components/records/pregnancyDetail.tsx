'use client';
import React from "react";
import { useState } from "react";
import { emit } from "process";
import PatientInformationDetail from "./patientInformationDetail";

const PregnancyDetail = () => {

    return (
        <div className="min-h-screen mt-10 flex bg-[#FDFEF9] w-full">

            <PatientInformationDetail />

        </div>
    )

}
export default PregnancyDetail;
