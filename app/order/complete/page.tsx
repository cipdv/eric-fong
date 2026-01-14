"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
type OrderResponse = {
  id: string;
  status: string;
  grossAmount: number;
  hstCollected: number;
  totalAmount: number;
};

async function fetchOrder(sessionId: string): Promise<OrderResponse> {
  const res = await fetch(`/api/order/by-session?session_id=${encodeURIComponent(sessionId)}`, {
    method: "GET",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load order.");
  return data as OrderResponse;
}

export default function OrderCompletePage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [status, setStatus] = useState<"pending" | "done" | "error">(
    () => (sessionId ? "pending" : "error")
  );
  const [message, setMessage] = useState<string | null>(
    () => (sessionId ? null : "Missing checkout session.")
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
        <h1 className="text-2xl font-semibold text-neutral-900">Order status</h1>
        <p className="text-sm text-red-600">{message || "Something went wrong confirming your order."}</p>
      </div>
    );
  }

  if (status === "pending" || !order) {
    return (
      <div className="space-y-3 pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900">Finishing up</h1>
        <p className="text-sm text-neutral-700">Processing your order…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-12">
      <h1 className="text-2xl font-semibold text-neutral-900">Order confirmed</h1>
      <p className="text-sm text-neutral-700">Order ID: {order.id}</p>
      <p className="text-sm text-neutral-700">Status: {order.status}</p>
      <p className="text-sm text-neutral-700">
        Total: ${order.totalAmount.toLocaleString("en-CA")} (HST: ${order.hstCollected.toLocaleString("en-CA")})
      </p>
    </div>
  );
}







