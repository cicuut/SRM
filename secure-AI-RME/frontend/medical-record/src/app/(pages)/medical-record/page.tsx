'use client';
import React from "react";
import { useState } from "react";
import { emit } from "process";
import Sidebar from "@/components/sidebar";
const MedicalRecord = () => {
   

    return (
        <div className="min-h-screen flex bg-[#FDFEF9]">
         <Sidebar/>
         <div className="flex-1 flex flex-col ml-70 py-10">
          this is medical record content
         </div>
        </div>
    )

}
export default  MedicalRecord;
