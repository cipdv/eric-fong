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
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-neutral-800">
          <span>Name</span>
          <input
            name="name"
            type="text"
            required
            className="w-full border border-neutral-900 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
            placeholder="Your name"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-neutral-800">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full border border-neutral-900 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
            placeholder="you@example.com"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-neutral-800 sm:col-span-2">
          <span>Phone number</span>
          <input
            name="phone"
            type="tel"
            className="w-full border border-neutral-900 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
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
          className="w-full border border-neutral-900 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
          // placeholder="How can we help?"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center border border-neutral-900 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500"
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
