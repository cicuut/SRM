"use client";
import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";

// Props for DateRangeFilter component
interface SelectDateProps {
  onFilterDate: (start: Date | null, end: Date | null) => void;
  selectedStartDate: Date | null;
  selectedEndDate: Date | null;
}

// Date range filter component with custom input
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

// Props for custom date range input button
interface CustomInputProps {
  value?: string;
  onClick?: () => void;
  startDate: Date | null;
  endDate: Date | null;
}

// Custom date range input button with forward ref
const CustomRangeInput = forwardRef<HTMLButtonElement, CustomInputProps>(
  ({ onClick, startDate, endDate }, ref) => {
    // Format date to Indonesian locale
    const formatDate = (date: Date) => {
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    };

    // Display date range text content
    const renderContent = () => {
      if (!startDate) return "Filter Tanggal";
      if (!endDate) return `${formatDate(startDate)}`;
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    };

    // Apply active style when dates are selected
    const activeStyle =
      startDate && endDate
        ? "border-[#739072] bg-[#F0F4EF] text-[#4F6F52]"
        : "border-gray-400 bg-white text-gray-700";

    return (
      <button
        type="button"
        onClick={onClick}
        ref={ref}
        className={`flex flex-row items-center justify-center min-w-[220px]  text-center border p-2 rounded-[50px] cursor-pointer gap-2 transition-all shadow-sm font-medium ${activeStyle}`}
      >
        <span className="text-xs uppercase tracking-wide">
          {renderContent()}
        </span>
        {!startDate && <Calendar className="size-4 " />}
      </button>
    );
  },
);

// Display name for debugging
CustomRangeInput.displayName = "CustomRangeInput";

export default DateRangeFilter;
