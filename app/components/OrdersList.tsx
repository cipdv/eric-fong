"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "./Spinner";
import { fulfillOrder, deleteOrder } from "@/app/actions/orders";

type OrderItem = {
  printId: string | null;
  quantity: number | null;
  unitPrice: string | null;
  size: string | null;
  paintingTitle: string | null;
};

type Order = {
  id: string;
  status: string;
  total_amount: string;
  currency: string;
  created_at: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  ship_address1: string | null;
  ship_address2: string | null;
  ship_city: string | null;
  ship_province: string | null;
  ship_postal: string | null;
  ship_country: string | null;
  items: OrderItem[] | null;
};

type Props = {
  orders: Order[];
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return formatter.format(d);
}

function formatPhone(raw?: string | null) {
  const digits = (raw ?? "").replace(/\D/g, "");
  // Strip leading country code if present (e.g., +1 or 1)
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(
      3,
      6
    )}-${normalized.slice(6)}`;
  }
  return raw || "N/A";
}

export default function OrdersList({ orders }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set<string>()
  );
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localOrders, setLocalOrders] = useState(orders);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  const visibleOrders = useMemo(
    () => localOrders.filter((o) => o.status !== "fulfilled"),
    [localOrders]
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFulfill = async (orderId: string) => {
    if (fulfillingId) return;
    setFulfillingId(orderId);
    try {
      await fulfillOrder(orderId);
      setLocalOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "fulfilled" } : o))
      );
      setSuccessMessage("Order fulfilled");
      setTimeout(() => setSuccessMessage(null), 2500);
      await new Promise((r) => setTimeout(r, 500));
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setFulfillingId(null);
    }
  };

  const handleDelete = async (orderId: string) => {
    if (deletingId) return;
    const ok = window.confirm("Delete this order? This cannot be undone.");
    if (!ok) return;
    setDeletingId(orderId);
    try {
      await deleteOrder(orderId);
      setLocalOrders((prev) => prev.filter((o) => o.id !== orderId));
      await new Promise((r) => setTimeout(r, 200));
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  if (!visibleOrders.length) {
    return <p className="text-sm text-neutral-700">No orders yet.</p>;
  }

  return (
    <div className="space-y-3">
      {successMessage && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}
      <h2 className="text-base font-semibold text-neutral-900">
        You have {visibleOrders.length} orders waiting to be fulfilled
      </h2>
      {visibleOrders.map((order) => {
        const isExpanded = expanded.has(order.id);
        const isLoading = fulfillingId === order.id || deletingId === order.id;
        const customerName =
          [
            order.customer_first_name ?? order.first_name,
            order.customer_last_name ?? order.last_name,
          ]
            .filter(Boolean)
            .join(" ") || "Unknown customer";
        const orderTotal = `$${Number(order.total_amount ?? 0).toLocaleString(
          "en-CA"
        )}`;
        const orderDate = formatDate(order.created_at);
        const shippingAddress =
          [
            order.ship_address1,
            order.ship_address2,
            order.ship_city,
            order.ship_province,
            order.ship_postal,
            order.ship_country,
          ]
            .filter(Boolean)
            .join(", ") || "N/A";
        return (
          <div
            key={order.id}
            className="overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm transition"
          >
            <button
              type="button"
              onClick={() => toggleExpand(order.id)}
              className="w-full px-4 py-4 text-left hover:bg-neutral-50"
              aria-expanded={isExpanded}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Customer
                  </div>
                  <div className="text-sm font-semibold text-neutral-900">
                    {customerName}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-800 sm:items-end">
                  <div className="flex flex-col">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Order date
                    </div>
                    <div>{orderDate}</div>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Total
                    </div>
                    <div className="text-lg font-semibold text-neutral-900">
                      {orderTotal}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-sky-700 underline underline-offset-4">
                    {isExpanded ? "Hide details" : "Show details"}
                  </div>
                </div>
              </div>
            </button>

            <div
              className={`px-4 transition-[max-height,opacity] duration-300 ${
                isExpanded
                  ? "max-h-[1200px] pb-5 pt-2 opacity-100"
                  : "max-h-0 overflow-hidden pb-0 pt-0 opacity-0"
              }`}
            >
              <div className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <div className="rounded border border-neutral-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Customer & contact
                  </p>
                  <div className="mt-1 text-sm font-semibold text-neutral-900">
                    {customerName}
                  </div>
                  <div className="mt-1 space-y-1 text-sm text-neutral-700">
                    <div>Email: {order.customer_email || "N/A"}</div>
                    <div>Phone: {formatPhone(order.customer_phone)}</div>
                    <div>Address: {shippingAddress}</div>
                  </div>
                </div>

                <div className="space-y-2 rounded border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span>Item</span>
                    <span>Size</span>
                    <span>Quantity</span>
                    <span>Unit price</span>
                  </div>
                  <div className="divide-y divide-neutral-100 text-sm text-neutral-800">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <div
                          key={`${order.id}-${item.printId ?? idx}`}
                          className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-2 py-2"
                        >
                          <span className="font-semibold">
                            {item.paintingTitle || "Untitled"}
                          </span>
                          <span className="text-neutral-700">
                            {item.size || "N/A"}
                          </span>
                          <span className="text-neutral-700">
                            {item.quantity ?? "N/A"}
                          </span>
                          <span className="text-neutral-700">
                            {item.unitPrice
                              ? `$${Number(item.unitPrice).toLocaleString(
                                  "en-CA"
                                )}`
                              : "N/A"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="py-2 text-sm text-neutral-600">No items.</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleFulfill(order.id)}
                    disabled={order.status === "fulfilled" || isLoading}
                    className="rounded border border-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading && fulfillingId === order.id
                      ? "Fulfilling..."
                      : "Fulfill order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(order.id)}
                    disabled={isLoading}
                    className="rounded border border-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === order.id ? "Deleting..." : "Delete order"}
                  </button>
                  {isLoading && fulfillingId === order.id && (
                    <Spinner
                      className="h-4 w-4 text-neutral-700"
                      label="Processing"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
