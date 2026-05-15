"use client";
import React from "react";

interface BillingFormProps {
  total: string;
  setTotal: (value: string) => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
}

const BillingForm = ({
  total,
  setTotal,
  paymentMethod,
  setPaymentMethod,
  paymentStatus,
  setPaymentStatus,
}: BillingFormProps) => {
  return (
    <>
      <div className="border-b-2 text-[#D9D9D9] font-bold">
        <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">
          Billing
        </p>
      </div>
      
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex flex-row gap-10 w-full ">
       
          <div className="flex flex-col flex-1 text-sm gap-2">
            <label className="block mb-1 font-bold text-black">Total</label>
            <input
              type="text"
              name="total"
              value={total}
              placeholder="contoh: 300000"
              onChange={(e) => setTotal(e.target.value)}
              className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 px-3 text-black"
            />
          </div>

          {/* Select Payment Method */}
          <div className="flex flex-col flex-1 text-sm gap-2">
            <label className="block mb-1 font-bold text-black">
              Payment Method
            </label>
            <select
              name="payment_method"
              value={paymentMethod}
              required
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="h-8.5 w-full rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 px-3 text-[13px] text-black"
            >
              <option value="" disabled>Pilih</option>
              <option value="Transfer">Transfer</option>
              <option value="QRIS">QRIS</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          {/* Select Status */}
          <div className="flex flex-col flex-1 text-sm gap-2">
            <label className="block mb-1 font-bold text-black">Status</label>
            <select
              name="payment_status"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              required
              className="h-8.5 w-full rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 px-3 text-[13px] text-black"
            >
              <option value="" disabled>Pilih</option>
              <option value="paid">Terbayar</option>
              <option value="unpaid">Belum Bayar</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
};

export default BillingForm;