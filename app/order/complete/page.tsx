"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/app/components/Spinner";
import Link from "next/link";
type OrderResponse = {
  id: string;
  status: string;
  grossAmount: number;
  hstCollected: number;
  totalAmount: number;
};

async function fetchOrder(sessionId: string): Promise<OrderResponse> {
  const res = await fetch(
    `/api/order/by-session?session_id=${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load order.");
  return data as OrderResponse;
}

export default function OrderCompletePage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [status, setStatus] = useState<"pending" | "done" | "error">(() =>
    sessionId ? "pending" : "error"
  );
  const [message, setMessage] = useState<string | null>(() =>
    sessionId ? null : "Missing checkout session."
  );

  useEffect(() => {
    if (status !== "done") return;
    try {
      window.localStorage.removeItem("cartItems");
    } catch {
      // ignore storage errors
    }
  }, [status]);

  useEffect(() => {
    if (!sessionId) return;
    let attempts = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await fetchOrder(sessionId);
        setOrder({
          id: data.id,
          status: data.status,
          grossAmount: data.grossAmount,
          hstCollected: data.hstCollected,
          totalAmount: data.totalAmount,
        });
        setStatus("done");
      } catch (err) {
        attempts += 1;
        if (attempts < 20) {
          setTimeout(poll, 1000);
        } else {
          setStatus("error");
          setMessage((err as Error).message);
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === "error") {
    return (
      <div className="space-y-3 pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Order status
        </h1>
        <p className="text-sm text-red-600">
          {message || "Something went wrong confirming your order."}
        </p>
      </div>
    );
  }

  if (status === "pending" || !order) {
    return (
      <div className="space-y-3 pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Finishing up your order . . .
        </h1>
        <Spinner label="Processing your order" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      <h1 className="text-2xl font-semibold text-neutral-900">
        Order confirmed
      </h1>
      <div className="rounded border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
        <p>
          Thank you for your order. I will contact you by email to arrange a
          delivery time.
        </p>
        <p className="mt-2">-Eric</p>
      </div>
      <div className="space-y-1 rounded border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
        <div>Order ID: {order.id}</div>
        <div>Status: {order.status}</div>
        <div>Total: ${order.totalAmount.toLocaleString("en-CA")}</div>
      </div>
      <Link
        href="/gallery"
        className="inline-flex w-fit items-center rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
      >
        Back to gallery
      </Link>
    </div>
  );
}
