"use client";

import { useActionState, useMemo } from "react";
import {
  requestRestockNotification,
  type RestockRequestState,
} from "@/app/actions/notify";

type PrintOption = {
  id: string;
  title: string;
  size: string | null;
};

type Props = {
  prints: PrintOption[];
  initialPrintId?: string;
};

const initialState: RestockRequestState = { status: "idle" };

export default function RestockRequestForm({ prints, initialPrintId }: Props) {
  const [state, formAction, pending] = useActionState(
    requestRestockNotification,
    initialState
  );

  const orderedPrints = useMemo(() => {
    return [...prints].sort((a, b) => a.title.localeCompare(b.title));
  }, [prints]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-neutral-800">
          <span>Name</span>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
            placeholder="Your name"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-neutral-800">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
            placeholder="you@example.com"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-neutral-800 sm:col-span-2">
          <span>Phone number</span>
          <input
            name="phone"
            type="tel"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
            placeholder="Optional"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-neutral-900">Select prints</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {orderedPrints.map((print) => (
            <label
              key={print.id}
              className="flex items-start gap-2 rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
            >
              <input
                type="checkbox"
                name="printIds"
                value={print.id}
                defaultChecked={initialPrintId === print.id}
              />
              <span>
                {print.title}
                {print.size ? ` (${print.size})` : ""}
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="block space-y-1 text-sm font-medium text-neutral-800">
        <span>Message</span>
        <textarea
          name="message"
          rows={4}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
          placeholder="Optional message"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600"
        >
          {pending ? "Submitting..." : "Notify me"}
        </button>
        {state.message ? (
          <p
            className={`text-sm ${
              state.status === "error" ? "text-red-600" : "text-green-700"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
