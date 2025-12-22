"use client";

import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { Spinner } from "./Spinner";

type Props = {
  printId: string;
  printSize: string;
  unitPrice: number;
  available: number;
  defaultQuantity: number;
};

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

type Billing = {
  name: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  postal: string;
  country: string;
};

function PaymentForm({
  printSize,
  unitPrice,
  available,
  defaultQuantity,
}: {
  printSize: string;
  unitPrice: number;
  available: number;
  defaultQuantity: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [billing, setBilling] = useState<Billing>({
    name: "",
    email: "",
    address1: "",
    address2: "",
    city: "",
    province: "",
    postal: "",
    country: "Canada",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const isBusy = status === "loading";

  const total = unitPrice * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setStatus("loading");
    setMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        shipping: {
          name: billing.name,
          address: {
            line1: billing.address1,
            line2: billing.address2,
            city: billing.city,
            state: billing.province,
            postal_code: billing.postal,
            country: billing.country,
          },
        },
        receipt_email: billing.email,
      },
      redirect: "if_required",
    });

    if (error) {
      setStatus("error");
      setMessage(error.message ?? "Payment failed.");
      return;
    }
    if (
      paymentIntent?.status === "succeeded" ||
      paymentIntent?.status === "processing"
    ) {
      setPaymentIntentId(paymentIntent.id);
      const finalizeRes = await fetch("/api/checkout/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      });
      if (!finalizeRes.ok) {
        const data = await finalizeRes.json();
        setStatus("error");
        setMessage(data.error ?? "Payment recorded, but inventory update failed.");
        return;
      }
      const finalizeData = await finalizeRes.json();
      setStatus("success");
      setMessage("Payment submitted. Redirecting...");
      setTimeout(() => {
        router.push(
          finalizeData?.orderId
            ? `/checkout/success?orderId=${finalizeData.orderId}`
            : "/checkout/success"
        );
      }, 500);
    } else {
      setStatus("error");
      setMessage("Payment not completed.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isBusy && (
        <div className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 shadow-inner">
          <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" aria-hidden="true" />
          Processing your payment...
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Order</h2>
        <div className="mt-3 space-y-2 text-sm text-neutral-800">
          <p>
            Print: {printSize} — ${unitPrice.toLocaleString("en-CA")}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-700">
              Quantity (max {available})
            </label>
            <input
              type="number"
              min={1}
              max={available}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
            />
          </div>
          <p className="font-semibold text-neutral-900">
            Total: ${total.toLocaleString("en-CA")}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="text-lg font-semibold text-neutral-900">
          Billing & Shipping
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Full name"
            className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={billing.name}
            onChange={(e) => setBilling({ ...billing, name: e.target.value })}
          />
          <input
            required
            type="email"
            placeholder="Email"
            className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={billing.email}
            onChange={(e) => setBilling({ ...billing, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <input
            required
            placeholder="Address line 1"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={billing.address1}
            onChange={(e) =>
              setBilling({ ...billing, address1: e.target.value })
            }
          />
          <input
            placeholder="Address line 2"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={billing.address2}
            onChange={(e) =>
              setBilling({ ...billing, address2: e.target.value })
            }
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              required
              placeholder="City"
              className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={billing.city}
              onChange={(e) =>
                setBilling({ ...billing, city: e.target.value })
              }
            />
            <input
              required
              placeholder="Province/State"
              className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={billing.province}
              onChange={(e) =>
                setBilling({ ...billing, province: e.target.value })
              }
            />
            <input
              required
              placeholder="Postal code"
              className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={billing.postal}
              onChange={(e) =>
                setBilling({ ...billing, postal: e.target.value })
              }
            />
          </div>
          <input
            required
            placeholder="Country"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            value={billing.country}
            onChange={(e) =>
              setBilling({ ...billing, country: e.target.value })
            }
          />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="text-lg font-semibold text-neutral-900">
          Payment details
        </h3>
        <PaymentElement
          options={{
            layout: "tabs",
            paymentMethodOrder: ["card"],
            fields: {
              billingDetails: {
                address: "auto",
              },
            },
          }}
        />
      </div>

      {status === "error" && message && (
        <p className="text-sm text-red-600">{message}</p>
      )}
      {status === "success" && message && (
        <p className="text-sm text-green-700">{message}</p>
      )}
      {paymentIntentId && (
        <p className="text-xs text-neutral-500">
          Payment ref: {paymentIntentId}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
      >
        {status === "loading" ? "Processing..." : "Pay now"}
      </button>
      <p className="text-xs text-neutral-500">
        Secure payments processed via Stripe.
      </p>
    </form>
  );
}

export default function CheckoutForm({
  printId,
  printSize,
  unitPrice,
  available,
  defaultQuantity,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);

  useEffect(() => {
    const createIntent = async () => {
      setLoadingIntent(true);
      setIntentError(null);
      try {
        const res = await fetch("/api/checkout-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printId,
            quantity: defaultQuantity,
            customer: {},
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to start checkout.");
        }
        setClientSecret(data.clientSecret);
      } catch (err) {
        setIntentError((err as Error).message);
      } finally {
        setLoadingIntent(false);
      }
    };
    createIntent();
  }, [printId, defaultQuantity]);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable.
      </div>
    );
  }

  if (intentError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {intentError}
      </div>
    );
  }

  if (loadingIntent || !clientSecret || !stripePromise) {
    return (
      <p className="flex items-center gap-2 text-sm text-neutral-600">
        <Spinner className="text-base" label="Loading checkout" />
        Loading checkout...
      </p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, locale: "en-CA" }}
    >
      <PaymentForm
        printSize={printSize}
        unitPrice={unitPrice}
        available={available}
        defaultQuantity={defaultQuantity}
      />
    </Elements>
  );
}
