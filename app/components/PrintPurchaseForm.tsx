"use client";

import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";

type Props = {
  printId: string;
  available: number;
};

type CartItem = {
  printId: string;
  quantity: number;
};

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("cartItems");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          printId: String(item?.printId ?? ""),
          quantity: Number(item?.quantity ?? 0),
        }))
        .filter((i) => i.printId && i.quantity > 0);
    }
  } catch {}
  return [];
}

function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("cartItems", JSON.stringify(items));
  window.dispatchEvent(new Event("cart:updated"));
}

export default function PrintPurchaseForm({ printId, available }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAddToCart = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setMessage(null);
    const addQuantity = Math.max(1, Math.min(available, quantity || 1));
    const current = loadCart();
    const existingIdx = current.findIndex((i) => i.printId === printId);
    if (existingIdx >= 0) {
      const existing = current[existingIdx];
      const nextQuantity = Math.min(
        available,
        Number(existing.quantity || 0) + addQuantity
      );
      current[existingIdx] = { printId, quantity: nextQuantity };
    } else {
      current.push({ printId, quantity: addQuantity });
    }
    saveCart(current);
    setMessage("Added to order.");
    setTimeout(() => setMessage(null), 2000);
    setIsAdding(false);
  };

  const addLabel = "Add to order";

  return (
    <form className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={1}
        max={available}
        value={quantity}
        onChange={(e) =>
          setQuantity(Math.max(1, Math.min(available, Number(e.target.value) || 1)))
        }
        className="w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
        aria-label="Quantity"
        disabled={available < 1}
      />
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={available < 1 || isAdding}
        className="flex items-center gap-2 rounded border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
      >
        {isAdding ? <Spinner className="h-4 w-4 text-neutral-600" label="Adding" /> : null}
        {addLabel}
      </button>
      {message ? (
        <span className="text-xs font-semibold text-emerald-700">{message}</span>
      ) : null}
    </form>
  );
}
