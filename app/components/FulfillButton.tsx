"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Spinner } from "./Spinner";
import { fulfillOrder } from "@/app/actions/orders";

type Props = {
  orderId: string;
  fulfilled?: boolean;
};

export default function FulfillButton({ orderId, fulfilled }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleClick = async () => {
    if (fulfilled || loading) return;
    setLoading(true);
    try {
      await fulfillOrder(orderId);
      // Show success via query param and refresh list
      const url = `${pathname}?fulfilled=1`;
      router.replace(url);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={fulfilled || loading}
      className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && <Spinner className="h-4 w-4 text-white" label="Fulfilling" />}
      {fulfilled ? "Already fulfilled" : loading ? "Fulfilling..." : "Mark as fulfilled"}
    </button>
  );
}
