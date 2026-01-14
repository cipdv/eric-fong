"use client";

import Link from "next/link";

type Props = {
  title?: string;
  subtitle?: string;
  checkoutHref?: string;
};

export default function OrderNavbar({
  title = "Current order",
  subtitle = "Review your picks before checkout.",
  checkoutHref = "/app/dashboard/orders",
}: Props) {
  return (
    <div className="sticky top-0 z-30 mb-4 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          <div className="text-xs text-neutral-600">{subtitle}</div>
        </div>
        <Link
          href={checkoutHref}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
