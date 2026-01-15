"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PrintPurchaseForm from "@/app/components/PrintPurchaseForm";

type Print = {
  id: string;
  size: string | null;
  price: number;
  quantity: number;
};

type Props = {
  prints: Print[];
};

export default function PrintSizeSelector({ prints }: Props) {
  const firstAvailableId =
    prints.find((print) => print.quantity > 0)?.id || prints[0]?.id || "";
  const [selectedId, setSelectedId] = useState(firstAvailableId);

  const selectedPrint = useMemo(() => {
    return prints.find((print) => print.id === selectedId) || prints[0];
  }, [prints, selectedId]);
  const sizeOptions = useMemo(() => {
    return prints.map((print) => {
      const rawSize = print.size || "Size coming soon";
      const label = rawSize
        .split("x")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (part.includes('"') ? part : `${part}"`))
        .join(" x ");
      return {
        id: print.id,
        label,
      };
    });
  }, [prints]);

  if (!selectedPrint) {
    return null;
  }

  const soldOut = selectedPrint.quantity < 1;
  const priceLabel = Number(selectedPrint.price ?? 0).toLocaleString("en-CA");
  const otherSizesAvailable = prints.some(
    (print) => print.id !== selectedPrint.id && print.quantity > 0
  );

  return (
    <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="space-y-2">
        {prints.length > 1 ? (
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Select size
          </div>
        ) : null}
        {prints.length > 1 ? (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
          >
            {sizeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-sm font-semibold text-neutral-900">
            {selectedPrint.size || "Size coming soon"}
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-neutral-700">${priceLabel}</div>
          <span
            className={`text-xs font-semibold ${
              soldOut ? "text-red-600" : "text-green-700"
            }`}
          >
            {soldOut ? "Sold out" : `${selectedPrint.quantity} available`}
          </span>
        </div>
      </div>
      {soldOut ? (
        <div className="space-y-2 text-xs text-neutral-700">
          <Link href="/contact" className="text-sky-700 transition hover:text-sky-800">
            Notify me when more become available
          </Link>
          {otherSizesAvailable ? (
            <div>Other sizes are currently available for this print.</div>
          ) : null}
        </div>
      ) : (
        <PrintPurchaseForm
          printId={selectedPrint.id}
          available={Math.max(0, selectedPrint.quantity)}
        />
      )}
    </div>
  );
}
