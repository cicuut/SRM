"use client";
import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";

interface SelectDateProps {
  onFilterDate: (start: Date | null, end: Date | null) => void;
  selectedStartDate: Date | null;
  selectedEndDate: Date | null;
}

const DateRangeFilter = ({
  onFilterDate,
  selectedStartDate,
  selectedEndDate,
}: SelectDateProps) => {
  return (
    <div className="relative">
      <DatePicker
        selectsRange={true}
        startDate={selectedStartDate}
        endDate={selectedEndDate}
        selected={selectedStartDate}
        onChange={(update: [Date | null, Date | null]) => {
          onFilterDate(update[0], update[1]);
        }}
        isClearable={true}
        placeholderText="Pilih Rentang Tanggal"
        customInput={
          <CustomRangeInput
            startDate={selectedStartDate}
            endDate={selectedEndDate}
          />
        }
        dateFormat="dd/MM/yyyy"
      />
    </div>
  );
};

interface CustomInputProps {
  value?: string;
  onClick?: () => void;
  startDate: Date | null;
  endDate: Date | null;
}

const CustomRangeInput = forwardRef<HTMLButtonElement, CustomInputProps>(
  ({ onClick, startDate, endDate }, ref) => {
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    // PERBAIKAN LOGIKA TEKS DISPLAY
    const renderContent = () => {
      if (!startDate) return "Filter Tanggal";
      
      // Jika baru klik sekali ATAU klik tanggal yang sama dua kali, tampilkan 1 tanggal saja
      if (!endDate || formatDate(startDate) === formatDate(endDate)) {
        return `${formatDate(startDate)}`;
      }
      
      // Jika rentang tanggal berbeda
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    };

    // PERBAIKAN STYLE AKTIF
    // Cukup cek apakah startDate ada, supaya saat klik pertama kali tombol langsung berubah hijau
    const activeStyle = startDate
      ? "border-[#739072] bg-[#F0F4EF] text-[#4F6F52]"
      : "border-gray-400 bg-white text-gray-700";

    return (
      <button
        type="button"
        onClick={onClick}
        ref={ref}
        className={`flex flex-row items-center justify-center min-w-[220px] text-center border p-2 rounded-[50px] cursor-pointer gap-2 transition-all shadow-sm font-medium ${activeStyle}`}
      >
        <span className="text-xs uppercase tracking-wide">
          {renderContent()}
        </span>
        {!startDate && <Calendar className="size-4" />}
      </button>
    );
  },
);

CustomRangeInput.displayName = "CustomRangeInput";

export default DateRangeFilter;