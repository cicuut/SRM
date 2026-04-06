"use client"
import React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";

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
        "delivery-record": "Tambah Rekam Persalinan"
    };


    const pathSnippets = pathname.split("/").filter((i) => i);
    return (
        <header className="py-4">
            <nav className="flex items-center gap-2 text-2xl font-bold text-[#4F6F52]">


                <Link href="/" className="hover:opacity-80 transition-opacity underline">
                    {breadcrumbNameMap[""]}
                </Link>

                {/* Generate Breadcrumbs Dibalik URL */}
                {pathSnippets.map((_, index) => {
                    const url = `/${pathSnippets.slice(0, index + 1).join("/")}`;
                    const isLast = index === pathSnippets.length - 1;
                    const label = breadcrumbNameMap[pathSnippets[index]] || pathSnippets[index];

                    return (
                        <React.Fragment key={url}>
                            <FontAwesomeIcon icon={faChevronRight} className="text-sm mx-1 opacity-50" />
                            {isLast ? (
                                <span className="underline">{label}</span>
                            ) : (
                                <Link href={url} className="hover:opacity-80 transition-opacity underline">
                                    {label}
                                </Link>
                            )}
                        </React.Fragment>
                    );
                })}
            </nav>
        </header>
    )
}
export default Header;