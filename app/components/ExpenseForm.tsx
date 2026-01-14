"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExpenseAction } from "@/app/actions/expenses";

const categories = [
  "Advertising",
  "Other",
  "Travel",
  "Licenses",
  "Insurance",
  "Interest paid",
  "Repairs and maintenance",
  "Other supplies",
  "Other expenses",
  "Office supplies",
  "Bank fees",
  "Admin fees",
  "Home office expenses",
];

const homeOfficeOptions = ["Rent", "Internet", "Cellphone", "Heat", "Hydro"];
const otherSuppliesOptions = ["Paint", "Brushes", "Canvas", "Other", "Pallette paper"];
const advertisingOptions = ["Website", "Online ads", "Print ads", "Finder's fees", "Other"];
const travelOptions = ["Transportation costs", "Accomodation", "Meals", "Other"];

type Props = {
  afterSave?: () => void;
};

export default function ExpenseForm({ afterSave }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [subcategory, setSubcategory] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hstIncluded, setHstIncluded] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const parsedAmount = parseFloat(amount) || 0;
  const computedHst = Math.round((hstIncluded ? parsedAmount * (13 / 113) : parsedAmount * 0.13) * 100) / 100;

  const isHomeOffice = category === "Home office expenses";
  const isOtherSupplies = category === "Other supplies";
  const isAdvertising = category === "Advertising";
  const isTravel = category === "Travel";


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    try {
      await createExpenseAction({
        amount,
        category,
        subcategory,
        details,
        date,
        hstIncluded,
      });
      setStatus("success");
      setMessage("Expense saved.");
      setAmount("");
      setSubcategory("");
      setDetails("");
      setDate(new Date().toISOString().slice(0, 10));
      setHstIncluded(false);
      afterSave?.();
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    } finally {
      if (status !== "success") setStatus("idle");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Add expense</h2>
      <div className="space-y-1">
        <label className="text-sm font-medium text-neutral-800">Amount (CAD)</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            required
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:max-w-xs"
          />
          <div className="flex items-center gap-2">
            <input
              id="hst-included"
              type="checkbox"
              checked={hstIncluded}
              onChange={(e) => setHstIncluded(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="hst-included" className="text-sm font-medium text-neutral-800">
              HST included?
            </label>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-neutral-800">Category</label>
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              setCategory(next);
              setSubcategory("");
            }}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        {isHomeOffice && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Home office type</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              required={isHomeOffice}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="" disabled>
                Select type
              </option>
              {homeOfficeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
        {isOtherSupplies && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Subcategory</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="" disabled>
                Select subcategory
              </option>
              {otherSuppliesOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
        {isAdvertising && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Subcategory</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="" disabled>
                Select subcategory
              </option>
              {advertisingOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
        {isTravel && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Subcategory</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="" disabled>
                Select subcategory
              </option>
              {travelOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
        {!isHomeOffice && !isOtherSupplies && !isAdvertising && !isTravel && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Subcategory</label>
            <input
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="Optional"
            />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-neutral-800">Details</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          placeholder="Optional"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-neutral-800">Date</label>
        <input
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </div>

      {status === "error" && message && (
        <p className="text-sm text-red-600">{message}</p>
      )}
      {status === "success" && message && (
        <p className="text-sm text-emerald-700">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
      >
        {status === "loading" ? "Saving..." : "Save expense"}
      </button>
    </form>
  );
}
