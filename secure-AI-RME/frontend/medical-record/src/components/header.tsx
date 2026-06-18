"use client";
import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const Header = () => {
  const pathname = usePathname();

  const breadcrumbNameMap: Record<string, string> = {
    "dashboard": "Dashboard",
    "daily-report": "Kunjungan Harian",
    "medical-record": "Rekam Medis",
    "financial-report": "Laporan Keuangan",
    "management-setting": "Kelola Manajemen",
    "account-setting": "Pengaturan Akun",
    "activity-history": "Riwayat Aktivitas",
    "pregnancy-record": "Tambah Rekam Kehamilan",
    "family-planning-record": "Tambah Rekam Keluarga Berencana",
    "general-record": "Tambah Rekam Umum",
    "immunization-record": "Tambah Rekam Imunisasi",
    "delivery-record": "Tambah Rekam Persalinan",
  };

  const visitTypeMap: Record<string, string> = {
    pregnancy: "Kehamilan",
    familyplanning: "Keluarga Berencana",
    general: "Umum",
    immunization: "Imunisasi",
    delivery: "Persalinan",
  };

  const pathSnippets = pathname.split("/").filter((i) => i);

  let skipNext = false;

  return (
    <header className="py-4">
      <nav className="flex items-center gap-2 text-xl md:text-2xl font-bold text-[#4F6F52]">
        <Link href="/" className="hover:opacity-80 transition-opacity underline">
          {breadcrumbNameMap[""]}
        </Link>

        {pathSnippets.map((snippet, index) => {
          if (skipNext) {
            skipNext = false; 
            return null;
          }

          if (snippet.length > 23) {
            return null;
          }

          let label = breadcrumbNameMap[snippet] || snippet;
          let currentUrl = `/${pathSnippets.slice(0, index + 1).join("/")}`;
          let isLast = index === pathSnippets.length - 1;

          if (snippet === "add-visit") {
            const nextSnippet = pathSnippets[index + 1];
            
            if (nextSnippet && visitTypeMap[nextSnippet]) {
              label = `Tambah Kunjungan ${visitTypeMap[nextSnippet]}`;
              
              currentUrl = `/${pathSnippets.slice(0, index + 2).join("/")}`;
              
              const segmentSetelahnya = pathSnippets[index + 2];
              if (!segmentSetelahnya || segmentSetelahnya.length > 30) {
                isLast = true;
              }

              skipNext = true;
            }
          }

          return (
            <React.Fragment key={currentUrl}>
              <ChevronRight className="mx-1 opacity-50 size-8" />
              {isLast ? (
                <span className="text-[#739072] underline cursor-default">{label}</span>
              ) : (
                <Link
                  href={currentUrl}
                  className="underline text-[#739072] cursor-pointer"
                >
                  {label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </header>
  );
};

export default Header;