"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getPrintsBulkAction } from "@/app/actions/prints";

type CartItem = { printId: string; quantity: number };
type Print = {
  id: string;
  title: string | null;
  size: string;
  price: number;
  quantity: number;
  image_url: string | null;
};

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("cartItems");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => ({
        printId: String(p?.printId ?? ""),
        quantity: Math.max(1, Number(p?.quantity ?? 1)),
      }))
      .filter((p) => p.printId && p.quantity > 0);
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("cartItems", JSON.stringify(items));
  window.dispatchEvent(new Event("cart:updated"));
}

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [prints, setPrints] = useState<Print[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const hasFetchedOnce = useRef(false);
  const prevIdsKey = useRef<string | null>(null);

  useEffect(() => {
    const items = loadCart();
    setCartItems(items);
  }, []);

  const cartIdsKey = useMemo(
    () =>
      cartItems
        .map((i) => i.printId)
        .sort()
        .join("|"),
    [cartItems]
  );

  useEffect(() => {
    const fetchPrints = async () => {
      const ids = cartItems.map((i) => i.printId);
      if (!ids.length) {
        setPrints([]);
        setLoading(false);
        prevIdsKey.current = "";
        hasFetchedOnce.current = true;
        return;
      }

      // Avoid refetch when quantities change but IDs stay the same
      if (prevIdsKey.current === cartIdsKey && hasFetchedOnce.current) {
        return;
      }

      prevIdsKey.current = cartIdsKey;
      if (!hasFetchedOnce.current) {
        setLoading(true);
      }
      setMessage(null);
      try {
        const data = await getPrintsBulkAction(ids);
        setPrints(data || []);
        hasFetchedOnce.current = true;
      } catch (err) {
        setMessage((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchPrints();
  }, [cartIdsKey, cartItems]);

  const summary = useMemo(() => {
    const map = new Map(prints.map((p) => [p.id, p]));
    const items = cartItems.map((item) => ({
      ...item,
      print: map.get(item.printId),
    }));
    const total = items.reduce((sum, item) => {
      const price = item.print ? Number(item.print.price) : 0;
      return sum + price * item.quantity;
    }, 0);
    return { items, total };
  }, [prints, cartItems]);

  const updateQuantity = (printId: string, quantity: number) => {
    const next = cartItems
      .map((item) =>
        item.printId === printId
          ? {
              ...item,
              quantity: (() => {
                const nextQty = Math.max(1, Math.floor(quantity) || 1);
                const available =
                  prints.find((print) => print.id === printId)?.quantity ??
                  nextQty;
                return Math.min(nextQty, Math.max(1, available));
              })(),
            }
          : item
      )
      .filter((i) => i.quantity > 0);
    setCartItems(next);
    saveCart(next);
  };

  const removeItem = (printId: string) => {
    const next = cartItems.filter((i) => i.printId !== printId);
    setCartItems(next);
    saveCart(next);
  };

  const clearCart = () => {
    setCartItems([]);
    saveCart([]);
    setPrints([]);
  };

  const handleCheckout = async () => {
    if (!summary.items.length) return;
    setCreatingSession(true);
    setMessage(null);
    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: summary.items.map((item) => ({
            printId: item.printId,
            quantity: item.quantity,
          })),
          customer: {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start checkout.");
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage("Checkout session created, but no URL returned.");
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setCreatingSession(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Review your order
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-700">Loading your cart...</p>
      ) : !summary.items.length ? (
        <div className="space-y-2">
          <p className="text-sm text-neutral-700">
            No items in your order yet.
          </p>
          <button
            type="button"
            onClick={() => router.push("/prints")}
            className="inline-flex items-center rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            Back to prints
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            {summary.items.map((item) => (
              <div
                key={item.printId}
                className="flex flex-col gap-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  {item.print?.image_url ? (
                    <div className="h-16 w-16 overflow-hidden rounded border border-neutral-200 bg-white">
                      <Image
                        src={item.print.image_url}
                        alt={item.print.title || "Print preview"}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-neutral-300 bg-white text-[10px] text-neutral-500">
                      No image
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-neutral-900">
                      {item.print?.title || "Untitled"}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {item.print?.size || "N/A"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm sm:justify-end">
                  <label className="sr-only" htmlFor={`qty-${item.printId}`}>
                    Quantity
                  </label>
                  <div className="flex items-center rounded border border-neutral-300 bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.printId, item.quantity - 1)
                      }
                      className="px-2 py-1 text-neutral-700 transition hover:bg-neutral-100"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      id={`qty-${item.printId}`}
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(
                          item.printId,
                          Number(e.target.value) || 1
                        )
                      }
                      className="w-16 border-x border-neutral-200 px-2 py-1 text-center text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.printId, item.quantity + 1)
                      }
                      className="px-2 py-1 text-neutral-700 transition hover:bg-neutral-100"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-neutral-700">
                    @ $
                    {item.print
                      ? Number(item.print.price).toLocaleString("en-CA")
                      : "0"}
                  </span>
                </div>
                <div className="flex sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => removeItem(item.printId)}
                    className="rounded border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-neutral-700">
              Subtotal:{" "}
              <span className="font-semibold text-neutral-900">
                ${summary.total.toLocaleString("en-CA")}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => router.push("/prints")}
                className="rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
              >
                Continue shopping
              </button>
              <button
                type="button"
                onClick={clearCart}
                className="rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
              >
                Clear cart
              </button>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={creatingSession}
                className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
              >
                {creatingSession ? "Starting checkout..." : "Checkout"}
              </button>
            </div>
          </div>
          {message && <p className="text-sm text-red-600">{message}</p>}
        </div>
      )}
    </div>
  );
}
