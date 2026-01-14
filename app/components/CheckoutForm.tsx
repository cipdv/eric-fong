"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  printId: string;
  printSize: string;
  unitPrice: number;
  available: number;
  defaultQuantity?: number;
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

export default function CheckoutForm({
  printId,
  printSize,
  unitPrice,
  available,
  defaultQuantity = 1,
}: Props) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [status, setStatus] = useState<"idle" | "added">("idle");

  useEffect(() => {
    setQuantity(Math.max(1, Math.min(available, defaultQuantity)));
  }, [available, defaultQuantity]);

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
    router.push("/checkout/cart");
  };

  const total = unitPrice * Math.max(1, quantity || 1);
  const addLabel = status === "added" ? "Updated" : "Add to order";

  return (
    <form className="space-y-4 p-4">
      <div className="text-sm text-neutral-600">
        Size: <span className="font-semibold text-neutral-900">{printSize}</span>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-neutral-800">Quantity</label>
        <input
          type="number"
          min={1}
          max={available}
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(1, Math.min(available, Number(e.target.value) || 1)))
          }
          className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
          disabled={available < 1}
        />
      </div>
      <div className="text-sm text-neutral-700">
        Unit price:{" "}
        <span className="font-semibold text-neutral-900">
          ${Number(unitPrice).toLocaleString("en-CA")}
        </span>
      </div>
      <div className="text-sm text-neutral-700">
        Total:{" "}
        <span className="font-semibold text-neutral-900">
          ${total.toLocaleString("en-CA")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={available < 1}
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          {addLabel}
        </button>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={available < 1}
          className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600"
        >
          {available < 1 ? "Sold out" : "Checkout"}
        </button>
      </div>
    </form>
  );
}
