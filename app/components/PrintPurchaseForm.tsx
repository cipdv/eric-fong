"use client";

import { useRouter } from "next/navigation";

type Props = {
  printId: string;
  available: number;
};

export default function PrintPurchaseForm({
  printId,
  available,
}: Props) {
  const router = useRouter();
  const quantity = 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({
      printId,
      quantity: String(quantity),
    });
    router.push(`/checkout?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center">
      <button
        type="submit"
        disabled={available < 1}
        className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
      >
        Purchase
      </button>
    </form>
  );
}
