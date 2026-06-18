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
    <div className="w-full">
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
        wrapperClassName="w-full"
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

    const renderContent = () => {
      if (!startDate) return "Filter Tanggal";
      
      if (!endDate || formatDate(startDate) === formatDate(endDate)) {
        return `${formatDate(startDate)}`;
      }
      
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    };

   
    const activeStyle = startDate
      ? "border-[#739072] bg-[#F0F4EF] text-[#4F6F52]"
      : "border-gray-400 bg-white text-gray-700";

    return (
      <button
        type="button"
        onClick={onClick}
        ref={ref}
        className={`flex flex-row items-center w-full justify-center text-center border py-1 md:py-2 px-2  rounded-[50px] cursor-pointer gap-1 transition-all shadow-sm font-medium ${activeStyle}`}
      >
        <span className="text-[8px] md:text-xs uppercase tracking-wide">
          {renderContent()}
        </span>
        {!startDate && <Calendar className="size-2 md:size-4" />}
      </button>
    );
  },
);

CustomRangeInput.displayName = "CustomRangeInput";

export default DateRangeFilter;