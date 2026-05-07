"use client"
import React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link";
import { ChevronRight } from 'lucide-react';

const Header = () => {
    const pathname = usePathname();

    const breadcrumbNameMap: Record<string, string> = {
        "dashboard": "Dashboard",
        "daily-report": "Kunjungan Harian",
        "medical-record": "Rekam Medis",
        "financial-report": "Laporan Keuangan",
        "management-setting": "Pengaturan Manajemen",
        "account-setting": "Pengaturan Akun",
        "activity-history": "Riwayat Aktivitas",
        "pregnancy-record": "Tambah Rekam Kehamilan",
        "family-planning-record": "Tambah Rekam Perencanaan Keluarga",
        "general-record": "Tambah Rekam Umum",
        "immunization-record": "Tambah Rekam Imunisasi",
        "delivery-record": "Tambah Rekam Persalinan",
        "pregnancy": "Kehamilan",
        "add-visit": "Tambah Kunjungan",
        "familyplanning": "Keluarga Berencana",
        "general": "Umum",
        "immunization": "Imunisasi",
        "delivery": "Persalinan"
    };


    const pathSnippets = pathname.split("/").filter((i) => i);
    return (
        <header className="py-4">
            <nav className="flex items-center gap-2 text-2xl font-bold text-[#4F6F52]">
                <Link href="/" className="hover:opacity-80 transition-opacity underline">
                    {breadcrumbNameMap[""]}
                </Link>

               {pathSnippets.map((snippet, index) => {
                    const url = `/${pathSnippets.slice(0, index + 1).join("/")}`;
                    const isLast = index === pathSnippets.length - 1;
                    
                    // 1. Logika Deteksi UUID (ID acak biasanya > 20 karakter)
                    if (snippet.length > 20) {
                        return null; 
                    }
                    const label = breadcrumbNameMap[snippet] || snippet;

                    return (
                        <React.Fragment key={url}>
                            <ChevronRight className="mx-1 opacity-50 size-8" />
                            
                                <span className="underline">{label}</span>
                            
                        </React.Fragment>
                    );
                })}
            </nav>
        </header>
    )
}
export default Header;