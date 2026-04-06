'use client';
import React from "react";
import { useState, useEffect } from "react";
import { emit } from "process";
import Sidebar from "@/components/sidebar";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { request } from "http";
import Cookies from 'js-cookie';

const PregnancyRecord = () => {
    const [patientFullname, setPatientFullname] = useState("");
    const [familyFullname, setFamilyFullname] = useState("");
    const [patientNik, setPatientNik] = useState("");
    const [familyNik, setFamilyNik] = useState("");
    const [patientDob, setPatientDob] = useState("");
    const [familyDob, setFamilyDob] = useState("");
    const [patientAge, setPatientAge] = useState("");
    const [familyAge, setFamilyAge] = useState("");
    const [patientGender, setPatientGender] = useState("");
    const [familyGender, setFamilyGender] = useState("");
    const [patientPhone, setPatientPhone] = useState("");
    const [familyPhone, setFamilyPhone] = useState("");
    const [patientAddress, setPatientAddress] = useState("");
    const [familyAddress, setFamilyAddress] = useState("");
    const [patientEducation, setPatientEducation] = useState("");
    const [familyEducation, setFamilyEducation] = useState("");
    const [familyOccupation, setFamilyOccupation] = useState("");
    const [patientOccupation, setPatientOccupation] = useState("");
    const [bpjs, setBpjs] = useState("");
    const [faskes, setFaskes] = useState("");
    const [prePregnancyWeight, setPrePregnancyWeight] = useState("");
    const [prePregnancyMUAC, setPrePregnancyMUAC] = useState("");
    const [contraceptiveHistory, setContraceptiveHistory] = useState("");
    const [geneticDiseaseHistory, setGeneticDiseaseHistory] = useState("");
    const [previousPregnancy, setPreviousPregnancy] = useState("");
    const [gestationalAge, setGestationalAge] = useState("");
    const [deliverMethod, setDeliverMethod] = useState("");
    const [pregnancyComplications, setPregnancyComplications] = useState("");
    const [deliveryComplications, setDeliveryComplications] = useState("");
    const [birthWeightLength, setBirthWeightLength] = useState("");
    const [postpartumPeriod, setPostpartumPeriod] = useState("");
    const [newbornComplications, setNewbornComplications] = useState("");
    const [postpartumComplications, setPostpartumComplications] = useState("");
    const [lastMenstrualPeriod, setLastMenstrualPeriod] = useState("");
    const [estimatedDate, setEstimatedDate] = useState("");
    const [diagnosis, setDiagnosis] = useState("");
    const [date, setDate] = useState("");
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [ttScreening, setTtScreening] = useState("");
    const [labResult, setLabResult] = useState("");
    const [muac, setMuac] = useState("");
    const [relation, setRelation] = useState("");
    const [rmNumber, setRmNumber] = useState("Generating RM Number");
    const searchParams = useSearchParams();

    const recordType = searchParams.get("type");

    const ageCalculation = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const dob = value;
        if (name === "patientDob") {
            setPatientDob(dob);
        } else if (name === "familyDob") {
            setFamilyDob(dob);
        }

        if (dob) {
            const birth = new Date(dob);
            const today = new Date();

            let year = today.getFullYear() - birth.getFullYear();
            let month = today.getMonth() - birth.getMonth();

            if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
                year--;
            }

            const ageResult = `${year} years old`;

            if (name === "patientDob") {
                setPatientAge(ageResult);
            } else if (name === "familyDob") {
                setFamilyAge(ageResult);
            }
        } else {
            setPatientAge("");
            setFamilyAge("");
        }
    };

    useEffect(() => {
        const fetchRmNumber = async () => {
            try {
                const token = Cookies.get('access_token');

                if (!token) {
                    setRmNumber("Unauthorized");
                    return;
                }

                const response = await axios.get(
                    `http://localhost:5000/api/medical-record/rm-number?type=${recordType}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                setRmNumber(response.data.next_rm_number);
            } catch (error) {
                console.error("Error fetching RM number:", error);
                setRmNumber("Failed to generate RM Number");
            }
        };

        if (recordType) fetchRmNumber();
    }, [recordType]);
    return (
        <div className="min-h-screen flex bg-[#FDFEF9]">
            <div className="flex-1 flex flex-col w-full ml-10 mt-7">
                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        value={rmNumber}
                        readOnly
                        className="bg-transparent font-mono font-bold cursor-not-allowed focus:outline-none text-3xl text-[#4F6F52] w-full"
                    />
                    <p className="text-[10px] text-gray-400">*Generated by the system</p>
                </div>
                <div className="flex flex-col gap-0">
                    <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none !font-lexend">Patient Information</h2>
                    <hr className="mt-0"></hr>
                </div>
                <div className="flex flex-col mt-4 gap-y-4">
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Nama Lengkap
                            <input type="text" value={patientFullname} onChange={(e) => setPatientFullname(e.target.value)} name="name" id="name" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            NIK
                            <input type="text" value={patientNik} onChange={(e) => setPatientNik(e.target.value)} name="nik" id="nik" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div>
                            Tanggal Lahir
                            <input type="date" value={patientDob} onChange={ageCalculation} name="patientDob" id="dob" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div>
                            Umur
                            <input type="text" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} name="patientAge" id="age" readOnly className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div>
                            Jenis Kelamin
                            <select value={patientGender} onChange={(e) => setPatientGender(e.target.value)} name="patientGender" id="gender" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                                <option value="" disabled>Pilih Jenis Kelamin</option>
                                <option value="wanita">Wanita</option>
                                <option value="pria">Pria</option>
                            </select>
                        </div>
                        <div>
                            Tipe Pasien
                            <input type="text" name="type" id="type" value={recordType || ""} disabled className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-start">
                        <div className="flex flex-col flex-1 gap-y-1" >
                            Nomor Telepon
                            <input type="text" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} name="phone" id="phone" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Alamat
                            <textarea value={patientAddress} onChange={(e) => setPatientAddress(e.target.value)} name="address" id="address" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Pendidikan
                            <select value={patientEducation} onChange={(e) => setPatientEducation(e.target.value)} name="education" id="education" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                                <option value="" disabled>Pilih Pendidikan</option>
                                <option value="SD">SD</option>
                                <option value="SMP">SMP</option>
                                <option value="SMA">SMA</option>
                                <option value="Diploma">Diploma</option>
                                <option value="Sarjana">Sarjana</option>
                                <option value="Pascasarjana">Pascasarjana</option>
                            </select>
                        </div>
                        <div className="flex flex-col flex-1 gap-y-1">
                            Profesi
                            <input type="text" value={patientOccupation} onChange={(e) => setPatientOccupation(e.target.value)} name="occupation" id="occupation" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1">
                            Nomor BPJS
                            <input type="text" value={bpjs} onChange={(e) => setBpjs(e.target.value)} name="bpjs" id="bpjs" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col flex-1 gap-y-1">
                            Faskes Utama
                            <input type="text" value={faskes} onChange={(e) => setFaskes(e.target.value)} name="faskes" id="faskes" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-0">
                    <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none !font-lexend">Family Profile</h2>
                    <hr className="mt-0"></hr>
                </div>
                <div className="flex flex-col mt-4 gap-y-4">
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Nama Lengkap
                            <input type="text" value={familyFullname} onChange={(e) => setFamilyFullname(e.target.value)} name="name" id="name" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            NIK
                            <input type="text" value={familyNik} onChange={(e) => setFamilyNik(e.target.value)} name="nik" id="nik" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div>
                            Tanggal Lahir
                            <input type="date" value={familyDob} onChange={ageCalculation} name="familyDob" id="dob" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div>
                            Umur
                            <input type="text" value={familyAge} onChange={(e) => setFamilyAge(e.target.value)} name="familyAge" id="age" disabled className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div>
                            Jenis Kelamin
                            <select value={familyGender} onChange={(e) => setFamilyGender(e.target.value)} name="" id="" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                                <option value="" disabled>Pilih Jenis Kelamin</option>
                                <option value="wanita">Wanita</option>
                                <option value="pria">Pria</option>
                            </select>
                        </div>
                        <div>
                            Hubungan
                            <input type="text" value={relation} onChange={(e) => setRelation(e.target.value)} name="type" id="type" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-start">
                        <div className="flex flex-col flex-1 gap-y-1" >
                            Nomor Telepon
                            <input type="text" value={familyPhone} onChange={(e) => setFamilyPhone(e.target.value)} name="phone" id="phone" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Alamat
                            <textarea value={familyAddress} onChange={(e) => setFamilyAddress(e.target.value)} name="address" id="address" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Pendidikan
                            <select value={familyEducation} onChange={(e) => setFamilyEducation(e.target.value)} name="familyEducation" id="familyEducation" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2">
                                <option value="" disabled>Pilih Pendidikan</option>
                                <option value="SD">SD</option>
                                <option value="SMP">SMP</option>
                                <option value="SMA">SMA</option>
                                <option value="Diploma">Diploma</option>
                                <option value="Sarjana">Sarjana</option>
                                <option value="Pascasarjana">Pascasarjana</option>
                            </select>                        </div>
                        <div className="flex flex-col flex-1 gap-y-1">
                            Profesi
                            <input type="text" value={familyOccupation} onChange={(e) => setFamilyOccupation(e.target.value)} name="occupation" id="occupation" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-0">
                    <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none !font-lexend">Past Obstetric History</h2>
                    <hr className="mt-0"></hr>
                </div>
                <div className="flex flex-col mt-4 gap-y-4">
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Berat Sebelum Kehamilan
                            <input type="text" value={prePregnancyWeight} onChange={(e) => setPrePregnancyWeight(e.target.value)} name="prePregnancyWeight" id="prePregnancyWeight" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            MUAC Sebelum Kehamilan
                            <input type="text" value={prePregnancyMUAC} onChange={(e) => setPrePregnancyMUAC(e.target.value)} name="prePregnancyMUAC" id="prePregnancyMUAC" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1" >
                            Riwayat Kontrasepsi
                            <input type="text" value={contraceptiveHistory} onChange={(e) => setContraceptiveHistory(e.target.value)} name="contraceptiveHistory" id="contraceptiveHistory" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col flex-1" >
                            Penyakit Genetik dalam Keluarga
                            <textarea value={geneticDiseaseHistory} onChange={(e) => setGeneticDiseaseHistory(e.target.value)} name="geneticDiseaseHistory" id="geneticDiseaseHistory" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-start">
                        <div className="flex flex-col flex-1 " >
                            Berapa kali hamil sebelumnya?
                            <input type="text" value={previousPregnancy} onChange={(e) => setPreviousPregnancy(e.target.value)} name="previousPregnancy" id="previousPregnancy" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Usia Kehamilan
                            <input type="text" value={gestationalAge} onChange={(e) => setGestationalAge(e.target.value)} name="gestationalAge" id="gestationalAge" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col flex-1 gap-y-1">
                            Cara Persalinan
                            <input type="text" value={deliverMethod} onChange={(e) => setDeliverMethod(e.target.value)} name="deliveryMode" id="deliveryMode" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Komplikasi Kehamilan
                            <textarea value={pregnancyComplications} onChange={(e) => setPregnancyComplications(e.target.value)} name="pregnancyComplications" id="pregnancyComplications" className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 text-wrap" />
                        </div>
                        <div className="flex flex-col flex-1 gap-y-1">
                            Komplikasi Persalinan
                            <textarea value={deliveryComplications} onChange={(e) => setDeliveryComplications(e.target.value)} name="deliveryComplications" id="deliveryComplications" className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 text-wrap" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Berat dan Panjang Lahir
                            <   input type="text" value={birthWeightLength} onChange={(e) => setBirthWeightLength(e.target.value)} name="birthWeightLength" id="birthWeightLength" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col flex-1 gap-y-1">
                            Periode Postpartum
                            <input type="text" value={postpartumPeriod} onChange={(e) => setPostpartumPeriod(e.target.value)} name="postpartumPeriod" id="postpartumPeriod" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Komplikasi Bayi Baru Lahir
                            <textarea value={newbornComplications} onChange={(e) => setNewbornComplications(e.target.value)} name="newbornComplications" id="newbornComplications" className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 text-wrap" />
                        </div>
                        <div className="flex flex-col flex-1 gap-y-1">
                            Komplikasi Postpartum
                            <textarea value={postpartumComplications} onChange={(e) => setPostpartumComplications(e.target.value)} name="postpartumComplications" id="postpartumComplications" className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 text-wrap" />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-0">
                    <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none !font-lexend">Current Pregnancy </h2>
                    <hr className="mt-0"></hr>
                </div>
                <div className="flex flex-col mt-4 gap-y-4">
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Hari Pertama Haid Terakhir
                            <input type="date" value={lastMenstrualPeriod} onChange={(e) => setLastMenstrualPeriod(e.target.value)} name="lastMenstrualPeriod" id="lastMenstrualPeriod" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            Tanggal Estimasi Persalinan
                            <input type="date" value={estimatedDate} onChange={(e) => setEstimatedDate(e.target.value)} name="estimatedDateOfDelivery" id="estimatedDateOfDelivery" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1" >
                            Diagnosis
                            <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} name="diagnosis" id="diagnosis" className="w-full h-50 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-0">
                    <h2 className="text-md text-[#4F6F52] mt-10 underline leading-none !font-lexend">General Examination</h2>
                    <hr className="mt-0"></hr>
                </div>
                <div className="flex flex-col mt-4 gap-y-4">
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Hari
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} name="date" id="date" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            Tinggi Badan
                            <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} name="height" id="height" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Berat Badan
                            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} name="weight" id="weight" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            TT Screening
                            <input type="text" value={ttScreening} onChange={(e) => setTtScreening(e.target.value)} name="ttScreening" id="ttScreening" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="flex flex-row w-full gap-20 justify-between">
                        <div className="flex flex-col flex-1 gap-y-1 ">
                            Hasil Lab
                            <textarea value={labResult} onChange={(e) => setLabResult(e.target.value)} name="laboratoryResults" id="laboratoryResults" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                        <div className="flex flex-col  flex-1">
                            MUAC
                            <input type="text" value={muac} onChange={(e) => setMuac(e.target.value)} name="muac" id="muac" className="w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2" />
                        </div>
                    </div>
                </div>
                <div className="flex justify-center gap-4 mt-10">
                    <button
                        type="submit"
                        className="px-8 py-2 bg-[#739072] text-white rounded-full hover:bg-[#4F6F52] shadow-lg transition font-bold cursor-pointer"
                    >
                        Simpan Rekam Medis
                    </button>
                </div>
            </div>
        </div>
    )

}
export default PregnancyRecord;
