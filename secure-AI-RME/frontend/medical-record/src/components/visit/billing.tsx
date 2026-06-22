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
  const isUnpaid = paymentStatus === "unpaid";
  return (
    <>
      <div className="border-b-2 text-[#D9D9D9] font-bold">
        <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold">
          Billing
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 px-5  md:grid-cols-3">
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">Total</p>
          <input
            type="number"
            name="total"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            required={!isUnpaid}
            disabled={isUnpaid}
            placeholder={
              isUnpaid ? "Nonaktif untuk status unpaid" : "Masukkan nominal"
            }
            className="p-2 w-full h-8 rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 px-3 text-black"
          />

          {isUnpaid && (
            <p className="mt-1 text-[11px] text-[#8A8A8A]">
              Nominal dikosongkan karena status pembayaran belum dibayar.
            </p>
          )}
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">
            Payment Method
          </p>
          <select
            name="payment_method"
            value={paymentMethod}
            required={!isUnpaid}
            disabled={isUnpaid}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="h-8.5 w-full rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 px-3 text-[13px] text-black"
          >
            <option value="" disabled>
              {isUnpaid
                ? "Nonaktif untuk status unpaid"
                : "Pilih metode pembayaran"}
            </option>
            <option value="Transfer">Transfer</option>
            <option value="QRIS">QRIS</option>
            <option value="Cash">Cash</option>
          </select>
        </label>
        <label className="block">
          <p className="text-md font-medium text-gray-700 md:text-sm">Status</p>
          <select
            name="payment_status"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            required
            className="h-8.5 w-full rounded-md bg-white drop-shadow-lg border border-gray-300 focus:outline-none focus:ring-2 px-3 text-[13px] text-black"
          >
            <option value="" disabled>
              Pilih
            </option>
            <option value="paid">Terbayar</option>
            <option value="unpaid">Belum Bayar</option>
          </select>
        </label>
      </div>
    </>
  );
};

export default BillingForm;
