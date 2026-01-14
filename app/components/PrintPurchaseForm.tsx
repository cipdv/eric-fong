"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
}

export default function PrintPurchaseForm({ printId, available }: Props) {
  const router = useRouter();
  const initialCart = loadCart();
  const initialFound = initialCart.find((i) => i.printId === printId);
  const initialQty = initialFound ? Math.max(1, initialFound.quantity) : 1;
  const [quantity, setQuantity] = useState(initialQty);
  const [status, setStatus] = useState<"idle" | "added">("idle");
  const [existingQty, setExistingQty] = useState<number | null>(
    initialFound ? Math.max(1, initialFound.quantity) : null
  );

  const handleAddToCart = (e: React.FormEvent) => {
    e.preventDefault();
    const nextQuantity = Math.max(1, Math.min(available, quantity || 1));
    const current = loadCart();
    const existingIdx = current.findIndex((i) => i.printId === printId);
    if (existingIdx >= 0) {
      current[existingIdx] = { printId, quantity: nextQuantity };
    } else {
      current.push({ printId, quantity: nextQuantity });
    }
    saveCart(current);
    setExistingQty(nextQuantity);
    setStatus("added");
    setTimeout(() => setStatus("idle"), 2000);
  };

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    const nextQuantity = Math.max(1, Math.min(available, quantity || 1));
    const current = loadCart();
    const existingIdx = current.findIndex((i) => i.printId === printId);
    if (existingIdx >= 0) {
      current[existingIdx] = { printId, quantity: nextQuantity };
    } else {
      current.push({ printId, quantity: nextQuantity });
    }
    saveCart(current);
    setExistingQty(nextQuantity);
    router.push("/checkout/cart");
  };

  const inCart = existingQty !== null;
  const addLabel =
    status === "added" ? "Updated" : inCart ? "Update order" : "Add to order";

  return (
    <form className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded border border-neutral-300 bg-white">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="px-2 py-1 text-neutral-700 transition hover:bg-neutral-100"
          aria-label="Decrease quantity"
          disabled={available < 1}
        >
          −
        </button>
        <input
          type="number"
          min={1}
          max={available}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.min(available, Number(e.target.value) || 1)))}
          className="w-16 border-x border-neutral-200 px-2 py-1 text-center text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
          aria-label="Quantity"
          disabled={available < 1}
        />
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, Math.min(available, q + 1)))}
          className="px-2 py-1 text-neutral-700 transition hover:bg-neutral-100"
          aria-label="Increase quantity"
          disabled={available < 1}
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={available < 1}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
      >
        {addLabel}
      </button>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={available < 1}
        className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600"
      >
        {available < 1 ? "Sold out" : "Checkout"}
      </button>
    </form>
  );
}
