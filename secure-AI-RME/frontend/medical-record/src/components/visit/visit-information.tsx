"use client";
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Cookies from "js-cookie";
import { useParams } from "next/navigation";

interface PatientInformationDetailList {
  rm_number?: string;
  patient_name: string;
  made_by: string;
  visit_date: string;
  nik: string;
}

const VisitInformation = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const uuid = params.id;
  const [visitData, setVisitData] =
    useState<PatientInformationDetailList | null>(null);

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!uuid) return;
      try {
        const token = Cookies.get("access_token");
        const response = await fetch(
          `http://localhost:5000/api/visit-report/get-visit-data/${uuid}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) throw new Error("Gagal mengambil data pasien");

        const data = await response.json();
        setVisitData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [uuid]);

  if (loading)
    return (
      <div className="p-8 text-center text-blue-600 animate-pulse">
        Sedang mengambil data medis...
      </div>
    );
  if (error)
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  return (
    <div className="w-full">
      <table className="w-full text-left border-separate">
        <tbody>
          <tr>
            <td className="w-40">Medical Record ID</td>
            <td className="w-4">:</td>
            <td>{visitData?.rm_number}</td>
          </tr>
          <tr>
            <td className=" ">Nama Pasien</td>
            <td>:</td>
            <td className="">{visitData?.patient_name}</td>
          </tr>
          <tr>
            <td className=" ">NIK</td>
            <td>:</td>
            <td className="">{visitData?.nik}</td>
          </tr>
          <tr>
            <td className=" ">Tanggal Kunjungan</td>
            <td>:</td>
            <td className="">{visitData?.visit_date}</td>
          </tr>
          <tr>
            <td className=" ">Dibuat Oleh</td>
            <td>:</td>
            <td className="">{visitData?.made_by}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default VisitInformation;
