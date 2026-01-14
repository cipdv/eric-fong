"use client";

import { use, useEffect, useMemo, useState } from "react";
import getStripe from "@/lib/getStripe";
import { getPrintByIdAction } from "@/app/actions/prints";
import { createCheckoutSessionAction } from "@/app/actions/checkout";

type Print = {
  id: string;
  price: number;
  quantity: number;
  size: string;
  title?: string | null;
};

export default function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ printId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearch = use(searchParams);
  const printId = resolvedParams.printId;
  const initialQuantity = useMemo(() => {
    const raw = Array.isArray(resolvedSearch?.quantity) ? resolvedSearch.quantity[0] : resolvedSearch?.quantity;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : 1;
  }, [resolvedSearch]);

  const [print, setPrint] = useState<Print | null>(null);
  const [loadingPrint, setLoadingPrint] = useState(true);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [loadingSession, setLoadingSession] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadingPrint(true);
      try {
        const data = await getPrintByIdAction(printId);
        setPrint(data);
        setQuantity((q) => Math.min(data.quantity || 1, q));
      } catch (err) {
        setMessage((err as Error).message);
      } finally {
        setLoadingPrint(false);
      }
    };
    load();
  }, [printId]);

  const total = useMemo(() => {
    if (!print) return 0;
    return Number(print.price) * quantity;
  }, [print, quantity]);

  const handleCheckout = async () => {
    if (!print) return;
    setLoadingSession(true);
    setMessage(null);
    try {
      const data = await createCheckoutSessionAction({
        items: [{ printId, quantity }],
        customer: {},
      });
      const stripe = await getStripe();
      if (!stripe) throw new Error("Stripe failed to load.");
      const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
      if (error) throw new Error(error.message);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoadingSession(false);
    }
  };

  if (loadingPrint) {
    return <p className="text-sm text-neutral-700">Loading print...</p>;
  }

  if (!print) {
    return <p className="text-sm text-red-600">{message || "Print not found."}</p>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900">Checkout</h1>
        <p className="text-sm text-neutral-700">
          {print.title ? `${print.title} — ` : ""}
          {print.size} • Unit price ${Number(print.price).toLocaleString("en-CA")} • Available {print.quantity}
        </p>
      </div>

      <div className="max-w-xl space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-neutral-800">Quantity</label>
          <input
            type="number"
            min={1}
            max={print.quantity}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(print.quantity, Number(e.target.value) || 1)))}
            disabled={loadingSession}
            className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 disabled:opacity-50"
          />
        </div>
        <div className="text-sm text-neutral-800">
          Total: <span className="font-semibold text-neutral-900">${total.toLocaleString("en-CA")}</span>
        </div>
        {message && <p className="text-sm text-red-600">{message}</p>}
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loadingSession}
          className="w-full rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
        >
          {loadingSession ? "Redirecting..." : "Continue to payment"}
        </button>
      </div>
    </div>
  );
}
