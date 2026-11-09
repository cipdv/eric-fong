"use client";

import { useState } from "react";
import { fulfillOrderFromEmail } from "@/app/actions/orders";

export default function OrderFulfillmentConfirmation({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return done ? <p role="status" className="font-medium text-green-700">This order is now marked fulfilled.</p> : (
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (pending) return;
      setPending(true);
      setError(null);
      try {
        await fulfillOrderFromEmail(token);
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update the order. Please try again.");
      } finally {
        setPending(false);
      }
    }}>
      <p>Confirm that this order has been shipped or handed to the customer.</p>
      <button type="submit" disabled={pending} className="rounded bg-neutral-900 px-5 py-3 font-semibold text-white disabled:opacity-50">
        {pending ? "Updating…" : "Confirm order fulfilled"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
