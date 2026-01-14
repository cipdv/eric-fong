"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  sendContactMessage,
  type ContactFormState,
} from "@/app/actions/contact";

const initialState: ContactFormState = { status: "idle" };

type ContactFormProps = {
  initialMessage?: string;
};

export default function ContactForm({ initialMessage }: ContactFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction, pending] = useActionState(
    sendContactMessage,
    initialState
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4"
    >
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

      <label className="block space-y-1 text-sm font-medium text-neutral-800">
        <span>Message</span>
        <textarea
          name="message"
          required
          rows={5}
          defaultValue={initialMessage}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
          placeholder="How can we help?"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600"
        >
          {pending ? "Sending..." : "Send message"}
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
