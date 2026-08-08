"use client";
import { useState } from "react";
import { Funnel, Check } from "lucide-react";
import RMTypeFilter from "./rm_type";

type visit_status_filter = {
  label: string;
  value: string;
};

const visit_status: visit_status_filter[] = [
  { label: "Semua Tipe", value: "All" },
  {
    label: "Approved",
    value: "approved",
  },
  {
    label: "Pending",
    value: "pending",
  },
];

interface Props {
  onFilterChange: (type: string, label: string) => void;
  currentLabel: string;
}

const VisitStatusFilter = ({ onFilterChange, currentLabel }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (item: visit_status_filter) => {
    setIsOpen(false);
    onFilterChange(item.value, item.label);
  };
  const filteredVisitStatus = visit_status.filter((item) => item.value !== currentLabel);
  const isFiltered =
    currentLabel !== "Status Kunjungan" && currentLabel !== "Semua Status";
  return (
    <div className="relative inline-block text-left">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center gap-1 min-w-22.5 md:min-w-55 text-center border p-1 md:p-2 rounded-[50px] border-gray-400 cursor-pointer${isFiltered
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
            {filteredVisitStatus.map((item) => (
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
export default VisitStatusFilter;
