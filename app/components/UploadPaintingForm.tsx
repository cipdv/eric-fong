"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPaintingAction } from "@/app/actions/gallery";

type Print = {
  width: string;
  height: string;
  price: string;
  quantity: string;
};

function formatCurrencyInput(value: string) {
  const numeric = value.replace(/[^0-9.]/g, "");
  if (!numeric) return "";
  const [wholeRaw, decimalRaw = ""] = numeric.split(".");
  const whole = wholeRaw ? Number(wholeRaw).toLocaleString("en-CA") : "";
  const decimal = decimalRaw ? `.${decimalRaw.slice(0, 2)}` : "";
  return `${whole}${decimal}`;
}

function stripCurrency(value: string) {
  return value.replace(/,/g, "");
}

type LocationOption = {
  id: string;
  name: string;
  notes: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  province?: string | null;
  postal?: string | null;
  country?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  commission_rate?: string | number | null;
};

type Props = {
  locations?: LocationOption[];
};

export default function UploadPaintingForm({ locations = [] }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [medium, setMedium] = useState("");
  const [sizeOriginalHeight, setSizeOriginalHeight] = useState("");
  const [sizeOriginalWidth, setSizeOriginalWidth] = useState("");
  const [priceOriginal, setPriceOriginal] = useState("");
  const [printsAvailable, setPrintsAvailable] = useState(false);
  const [statusValue, setStatusValue] = useState("available for sale");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [prints, setPrints] = useState<Print[]>([
    { width: "", height: "", price: "", quantity: "" },
  ]);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<
    null | "idle" | "loading" | "success" | "error"
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [, startTransition] = useTransition();

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-stop-toggle="true"]')) return;
    setIsOpen((open) => !open);
  };

  const handlePrintChange = (
    index: number,
    field: keyof Print,
    value: string
  ) => {
    setPrints((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addPrint = () => {
    setPrints((prev) => [
      ...prev,
      { width: "", height: "", price: "", quantity: "" },
    ]);
  };

  const removePrint = (index: number) => {
    setPrints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const imageFile = fileInputRef.current?.files?.[0] ?? file;

    if (!imageFile) {
      setStatus("error");
      setMessage("Please select an image.");
      return;
    }

    try {
      const sanitizedPrints = prints.map((p) => ({
        width: p.width,
        height: p.height,
        price: stripCurrency(p.price),
        quantity: p.quantity,
      }));

      const formData = new FormData();
      formData.append("title", title);
      formData.append("details", details);
      formData.append("medium", medium);
      formData.append("sizeOriginalHeight", sizeOriginalHeight);
      formData.append("sizeOriginalWidth", sizeOriginalWidth);
      formData.append("priceOriginal", stripCurrency(priceOriginal));
      formData.append("printsAvailable", String(printsAvailable));
      formData.append("status", statusValue);
      if (locationId) {
        formData.append("locationId", locationId);
      }
      formData.append("image", imageFile);
      formData.append("prints", JSON.stringify(sanitizedPrints));

      await createPaintingAction(formData);

      setStatus("success");
      setMessage("Painting uploaded successfully.");
      startTransition(() => router.refresh());
      setTitle("");
      setDetails("");
      setMedium("");
      setSizeOriginalHeight("");
      setSizeOriginalWidth("");
      setPriceOriginal("");
      setPrintsAvailable(false);
      setPrints([{ width: "", height: "", price: "", quantity: "" }]);
      setFile(null);
      setPreviewUrl(null);
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    }
  };

  return (
    <div
      className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm cursor-pointer"
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.currentTarget !== e.target) return;
          e.preventDefault();
          handleToggle(e);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">
          Upload a new painting
        </h2>
      </div>

      {isOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 cursor-default"
          data-stop-toggle="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-800">
              Title
            </label>
            <input
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-800">
              Details
            </label>
            <textarea
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-800">
                Medium
              </label>
              <input
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-800">
                Size
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Width"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  value={sizeOriginalWidth}
                  onChange={(e) => setSizeOriginalWidth(e.target.value)}
                  required
                />
                <input
                  placeholder="Height"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  value={sizeOriginalHeight}
                  onChange={(e) => setSizeOriginalHeight(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-800">
              Price of original
            </label>
            <input
              inputMode="decimal"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={priceOriginal}
              onChange={(e) =>
                setPriceOriginal(formatCurrencyInput(e.target.value))
              }
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-800">
                Status
              </label>
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="available for sale">Available for sale</option>
                <option value="sold">Sold</option>
                <option value="not available for sale">
                  Not available for sale
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-800">
                Location
              </label>
              <select
                value={locationId || ""}
                onChange={(e) => setLocationId(e.target.value || null)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="">No location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-800">
              Image
            </label>
            <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded border border-dashed bg-neutral-100 border-neutral-300 px-4 py-6 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg, image/png, image/webp"
                className="hidden"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] ?? null;
                  setFile(nextFile);
                  setPreviewUrl(
                    nextFile ? URL.createObjectURL(nextFile) : null
                  );
                }}
                required
              />
              Choose file
            </label>
            {file && (
              <p className="text-xs text-neutral-600">
                Selected: {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
            {previewUrl && (
              <div className="mt-3 w-full max-w-xs overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Painting preview"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
              <input
                type="checkbox"
                checked={printsAvailable}
                onChange={(e) => setPrintsAvailable(e.target.checked)}
              />
              Prints available
            </label>
          </div>

          {printsAvailable && (
            <div className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-800">
                  Print sizes
                </span>
                <button
                  type="button"
                  onClick={addPrint}
                  className="rounded bg-sky-600 px-3 py-1 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                >
                  Add size
                </button>
              </div>
              <div className="space-y-3">
                {prints.map((print, index) => (
                  <div
                    key={index}
                    className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Width (in)"
                        className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        value={print.width}
                        onChange={(e) =>
                          handlePrintChange(index, "width", e.target.value)
                        }
                        required
                      />
                      <input
                        placeholder="Height (in)"
                        className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        value={print.height}
                        onChange={(e) =>
                          handlePrintChange(index, "height", e.target.value)
                        }
                        required
                      />
                    </div>
                    <input
                      placeholder="Price"
                      inputMode="decimal"
                      className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      value={print.price}
                      onChange={(e) =>
                        handlePrintChange(
                          index,
                          "price",
                          formatCurrencyInput(e.target.value)
                        )
                      }
                      required
                    />
                    <input
                      placeholder="Quantity"
                      type="number"
                      min="0"
                      className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      value={print.quantity}
                      onChange={(e) =>
                        handlePrintChange(index, "quantity", e.target.value)
                      }
                      required
                    />
                    {prints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePrint(index)}
                        className="rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-200"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === "error" && message && (
            <p className="text-sm text-red-600">{message}</p>
          )}
          {status === "success" && message && (
            <p className="text-sm text-green-700">{message}</p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
          >
            {status === "loading" ? "Uploading..." : "Upload painting"}
          </button>
        </form>
      )}
    </div>
  );
}
