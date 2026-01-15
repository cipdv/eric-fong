"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CartItem = {
  printId: string;
  quantity: number;
};

type CatalogItem = {
  printId: string;
  paintingTitle: string;
  size: string;
  price: number;
};

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("cartItems");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        printId: String(item?.printId ?? ""),
        quantity: Number(item?.quantity ?? 0),
      }))
      .filter((item) => item.printId && item.quantity > 0);
  } catch {
    return [];
  }
}

type Props = {
  catalog: CatalogItem[];
};

export default function PrintsCartBanner({ catalog }: Props) {
  const catalogMap = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    catalog.forEach((item) => {
      map.set(item.printId, item);
    });
    return map;
  }, [catalog]);
  const [items, setItems] = useState<CartItem[]>(() => readCart());
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  useEffect(() => {
    const handleCartUpdate = () => {
      setItems(readCart());
    };

    window.addEventListener("storage", handleCartUpdate);
    window.addEventListener("cart:updated", handleCartUpdate as EventListener);

    return () => {
      window.removeEventListener("storage", handleCartUpdate);
      window.removeEventListener("cart:updated", handleCartUpdate as EventListener);
    };
  }, []);

  if (itemCount < 1) return null;

  const subtotal = items.reduce((sum, item) => {
    const meta = catalogMap.get(item.printId);
    if (!meta) return sum;
    return sum + meta.price * item.quantity;
  }, 0);

  const clearCart = () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("cartItems", JSON.stringify([]));
    window.dispatchEvent(new Event("cart:updated"));
  };

  return (
    <div className="sticky top-[4rem] z-20 lg:top-0">
      <div className="mx-auto w-full max-w-6xl rounded-b-lg border border-neutral-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-neutral-900">
            Cart: {itemCount} item{itemCount === 1 ? "" : "s"}
          </div>
          <div className="text-sm font-semibold text-neutral-900">
            Subtotal: ${subtotal.toLocaleString("en-CA")}
          </div>
        </div>
        <div className="mt-3 divide-y divide-neutral-200 text-xs text-neutral-700">
          {items.map((item) => {
            const meta = catalogMap.get(item.printId);
            const title = meta?.paintingTitle || "Print";
            const size = meta?.size || "Size coming soon";
            const price = meta?.price ?? 0;
            const lineTotal = price * item.quantity;
            return (
              <div
                key={item.printId}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-neutral-900">{title}</div>
                  <div className="text-[11px] text-neutral-600">{size}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-neutral-600">
                    {item.quantity} × ${price.toLocaleString("en-CA")}
                  </div>
                  <div className="font-semibold text-neutral-900">
                    ${lineTotal.toLocaleString("en-CA")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={clearCart}
            className="rounded border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-100"
          >
            Clear cart
          </button>
          <Link
            href="/checkout/cart"
            className="rounded bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
