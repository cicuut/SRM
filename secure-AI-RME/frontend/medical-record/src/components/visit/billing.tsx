"use client";
import React, { useEffect, useState, useMemo } from "react";

export interface BillingItemFormProps {
  id: string;
  item_name: string;
  quantity: string;
  unit_cost: string;
}

interface BillingFormProps {
  total: string;
  setTotal: (value: string) => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  isSubmitting?: boolean;
  onItemsChange?: (items: BillingItemFormProps[]) => void;
}

const createEmptyBillingItem = (id: string): BillingItemFormProps => ({
  id,
  item_name: "",
  quantity: "1",
  unit_cost: "0",
});

const formatRupiah = (value: string | number) => {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number.isNaN(numericValue) ? 0 : numericValue);
};

const labelClassName = "block text-[11px] font-bold text-[#2F3A2F]";
const inputClassName =
  "mt-1 h-[42px] w-full rounded-[10px] border border-[#D2D8CF] bg-white px-3 text-[13px] text-black outline-none transition-all focus:border-[#739072] focus:ring-2 focus:ring-[#739072]/10 disabled:bg-[#F8FAF6] disabled:cursor-not-allowed";

const BillingForm: React.FC<BillingFormProps> = ({
  total,
  setTotal,
  paymentMethod,
  setPaymentMethod,
  paymentStatus,
  setPaymentStatus,
  isSubmitting = false,
  onItemsChange,
}) => {
  const isUnpaid = paymentStatus === "unpaid";

  const [billingItems, setBillingItems] = useState<BillingItemFormProps[]>([
    createEmptyBillingItem("item-1"),
  ]);

  const invoiceTotal = useMemo(
    () =>
      billingItems.reduce(
        (acc, item) =>
          acc + Number(item.quantity || 0) * Number(item.unit_cost || 0),
        0
      ),
    [billingItems]
  );

 useEffect(() => {
    if (isUnpaid) {
      setPaymentMethod("");
      setTotal("0");
      setBillingItems([createEmptyBillingItem("item-1")]);
    }
  }, [isUnpaid, setPaymentMethod, setTotal]);

  useEffect(() => {
    if (!isUnpaid) {
      setTotal(invoiceTotal.toString());
    } else {
      setTotal("0");
    }

    if (onItemsChange) {
      onItemsChange(billingItems);
    }
  }, [billingItems, invoiceTotal, isUnpaid, setTotal, onItemsChange]);

  const handleBillingItemChange = (
    itemId: string,
    field: keyof Omit<BillingItemFormProps, "id">,
    value: string
  ) => {
    setBillingItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const addBillingItem = () => {
    setBillingItems((currentItems) => [
      ...currentItems,
      createEmptyBillingItem(`item-${Date.now()}`),
    ]);
  };

  const removeBillingItem = (itemId: string) => {
    setBillingItems((currentItems) =>
      currentItems.length === 1
        ? currentItems
        : currentItems.filter((item) => item.id !== itemId)
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="border-b-2 text-[#D9D9D9] font-bold">
        <p className="text-sm border-b-2 w-fit border-[#739072] text-[#739072] font-bold pb-1">
          Billing
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-1 md:grid-cols-3">
        <label className="block">
          <span className={labelClassName}>Total Biaya</span>
          <div className="mt-1 flex h-[42px] w-full items-center rounded-[10px] border border-[#D2D8CF] bg-[#F8FAF6] px-3 text-[13px] font-bold text-[#2F3A2F]">
            {isUnpaid ? "Rp 0" : formatRupiah(invoiceTotal)}
          </div>
          {isUnpaid && (
            <p className="mt-1 text-[11px] text-[#8A8A8A]">
              Nominal dikosongkan karena status pembayaran belum dibayar.
            </p>
          )}
        </label>

        <label className="block">
          <span className={labelClassName}>Payment Method</span>
          <select
            name="payment_method"
            value={paymentMethod}
            required={!isUnpaid}
            disabled={isUnpaid || isSubmitting}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="mt-1 h-[42px] w-full rounded-[10px] bg-white border border-[#D2D8CF] px-3 text-[13px] text-black outline-none focus:border-[#739072] disabled:bg-[#F8FAF6] disabled:cursor-not-allowed"
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
          <span className={labelClassName}>Status Pembayaran</span>
          <select
            name="payment_status"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            required
            disabled={isSubmitting}
            className="mt-1 h-[42px] w-full rounded-[10px] bg-white border border-[#D2D8CF] px-3 text-[13px] text-black outline-none focus:border-[#739072]"
          >
            <option value="" disabled>
              Pilih Status
            </option>
            <option value="paid">Terbayar</option>
            <option value="unpaid">Belum Bayar</option>
          </select>
        </label>

        <div className="rounded-[12px] border border-[#D2D8CF] bg-[#FDFEF9] p-4 md:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-bold text-[#4F6F52]">
                Rincian Biaya
              </h2>
              <p className="mt-0.5 text-[11px] text-[#6B6B6B]">
                Total dihitung otomatis dari (jumlah × biaya per item).
              </p>
            </div>

            <button
              type="button"
              onClick={addBillingItem}
              disabled={isSubmitting}
              className="h-[34px] rounded-full bg-[#86A789] px-4 text-[11px] font-bold text-white hover:bg-[#739072] transition-all disabled:opacity-60"
            >
              + Tambah Item
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {billingItems.map((item, index) => {
              const subtotal =
                Number(item.quantity || 0) * Number(item.unit_cost || 0);

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-1 gap-3 rounded-[10px] border border-[#E4E8E1] bg-white p-3 md:grid-cols-[1fr_120px_180px_160px_auto] md:items-end"
                >
                  <label className="block">
                    <span className={labelClassName}>
                      Layanan / Item {index + 1}
                    </span>
                    <input
                      type="text"
                      value={item.item_name}
                      onChange={(event) =>
                        handleBillingItemChange(
                          item.id,
                          "item_name",
                          event.target.value
                        )
                      }
                      required
                      disabled={isSubmitting || isUnpaid}
                      placeholder="Contoh: Pemeriksaan / Obat"
                      className={inputClassName}
                    />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Jumlah</span>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(event) =>
                        handleBillingItemChange(
                          item.id,
                          "quantity",
                          event.target.value
                        )
                      }
                      min="1"
                      step="1"
                      required
                      disabled={isSubmitting || isUnpaid}
                      className={inputClassName}
                    />
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Biaya per Item</span>
                    <input
                      type="number"
                      value={item.unit_cost}
                      onChange={(event) =>
                        handleBillingItemChange(
                          item.id,
                          "unit_cost",
                          event.target.value
                        )
                      }
                      min="0"
                      step="100"
                      required
                      disabled={isSubmitting || isUnpaid}
                      placeholder="0"
                      className={inputClassName}
                    />
                  </label>

                  <div>
                    <span className={labelClassName}>Subtotal</span>
                    <div className="mt-1 flex h-[42px] items-center rounded-[10px] bg-[#F8FAF6] px-3 text-[13px] font-bold text-[#2F3A2F]">
                      {formatRupiah(subtotal)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeBillingItem(item.id)}
                    disabled={isSubmitting || billingItems.length === 1}
                    className="h-[42px] rounded-[10px] border border-red-200 px-3 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Hapus
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingForm;