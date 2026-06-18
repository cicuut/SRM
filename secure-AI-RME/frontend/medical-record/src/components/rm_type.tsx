"use client";
import { useState } from "react";
import { Funnel, Check } from "lucide-react";

type rm_type_filter = {
  label: string;
  value: string;
};

const rm_type: rm_type_filter[] = [
  { label: "Semua Tipe", value: "All" },
  {
    label: "Kehamilan",
    value: "Kehamilan",
  },
  {
    label: "Keluarga Berencana",
    value: "Keluarga Berencana",
  },
  {
    label: "Bayi dan Imunisasi",
    value: "Imunisasi",
  },
  {
    label: "Poli Umum",
    value: "Umum",
  },
  {
    label: "Persalinan",
    value: "Persalinan",
  },
];

interface Props {
  onFilterChange: (type: string, label: string) => void;
  currentLabel: string;
}

const RMTypeFilter = ({ onFilterChange, currentLabel }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (item: rm_type_filter) => {
    setIsOpen(false);
    onFilterChange(item.value, item.label);
  };

  const isFiltered =
    currentLabel !== "Tipe RM" && currentLabel !== "Semua Tipe";
  return (
    <div className="relative inline-block text-left">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center gap-1 min-w-[90px] md:min-w-[220px] text-center border p-1 md:p-2 rounded-[50px] border-gray-400 cursor-pointer${isFiltered
          ? "bg-[#F0F4EF] border-[#739072] text-[#4F6F52] border"
          : "bg-white border-gray-400 border text-gray-700"
          }`}
      >
        <span className="text-[8px] md:text-[11px] font-bold uppercase tracking-wide">
          {currentLabel}
        </span>
        {!isFiltered && <Funnel className="size-2 md:size-3.5 text-gray-400" />}
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          ></div>

          <ul className="absolute left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 mt-2 w-40 md:w-56 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-150 py-1">
            {rm_type.map((item) => (
              <li
                key={item.value}
                onClick={() => handleSelect(item)}
                className="group flex items-center justify-between px-4 py-3 hover:bg-[#F0F4EF] cursor-pointer transition-colors"
              >
                <span
                  className={`text-[12px] ${currentLabel === item.label
                    ? "text-[#739072] font-bold"
                    : "text-gray-600"
                    }`}
                >
                  {item.label}
                </span>
                {currentLabel === item.label && (
                  <Check className="size-4 text-[#739072]" />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
export default RMTypeFilter;
