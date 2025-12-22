"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Print = {
  id: string;
  size: string;
  price: string;
  quantity: number;
};

type Painting = {
  id: string;
  title: string;
  image_url: string;
  details: string;
  medium: string;
  size_original: string;
  price_original: string;
  prints: Print[];
  is_home_image?: boolean;
  status?: string;
};

function formatStatus(status?: string | null) {
  if (!status) return "Available for sale";
  const normalized = status.trim().toLowerCase();
  if (normalized === "sold") return "Sold";
  if (normalized === "not available for sale") return "Not available for sale";
  if (normalized === "available for sale") return "Available for sale";
  return status;
}

type Props = {
  paintings: Painting[];
};

export default function GalleryEditor({ paintings }: Props) {
  const [items, setItems] = useState(paintings);
  const [homeId, setHomeId] = useState<string | null>(
    paintings.find((p) => p.is_home_image)?.id ?? null
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const handleFieldChange = (
    paintingId: string,
    field: keyof Painting,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((p) => (p.id === paintingId ? { ...p, [field]: value } : p))
    );
  };

  const handlePrintChange = (
    paintingId: string,
    printId: string,
    field: keyof Print,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((p) =>
        p.id === paintingId
          ? {
              ...p,
              prints: p.prints.map((pr) =>
                pr.id === printId ? { ...pr, [field]: value } : pr
              ),
            }
          : p
      )
    );
  };

  const handleSave = async (painting: Painting) => {
    setSavingId(painting.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/paintings/${painting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: painting.title,
          details: painting.details,
          medium: painting.medium,
          size_original: painting.size_original,
          price_original: painting.price_original,
        prints: painting.prints.map((pr) => ({
          id: pr.id,
          price: pr.price,
          size: pr.size,
        })),
        is_home_image: homeId === painting.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setMessage("Saved.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (paintingId: string) => {
    if (!confirm("Delete this painting? This cannot be undone.")) return;
    setDeletingId(paintingId);
    setMessage(null);
    try {
      const res = await fetch(`/api/paintings/${paintingId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      setItems((prev) => prev.filter((p) => p.id !== paintingId));
      setMessage("Deleted.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectHome = (paintingId: string) => {
    setHomeId(paintingId);
    setItems((prev) =>
      prev.map((p) => ({ ...p, is_home_image: p.id === paintingId }))
    );
  };

  return (
    <div className="space-y-6">
      {items.length === 0 && (
        <p className="text-sm text-neutral-600">No paintings yet.</p>
      )}
      {items.map((painting) => (
        <div
          key={painting.id}
          className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="flex flex-col gap-2">
              <div className="overflow-hidden rounded border border-neutral-200 bg-neutral-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={painting.image_url}
                  alt={painting.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <label className="flex items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm">
                <input
                  type="radio"
                  name="home-image"
                  checked={homeId === painting.id}
                  onChange={() => handleSelectHome(painting.id)}
                />
                Set as homepage image
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-neutral-800">
                  Title
                </label>
                <input
                  value={painting.title}
                  onChange={(e) =>
                    handleFieldChange(painting.id, "title", e.target.value)
                  }
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />

                <label className="block text-sm font-medium text-neutral-800">
                  Details
                </label>
                <textarea
                  value={painting.details || ""}
                  onChange={(e) =>
                    handleFieldChange(painting.id, "details", e.target.value)
                  }
                  rows={4}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />

                <label className="block text-sm font-medium text-neutral-800">
                  Medium
                </label>
                <input
                  value={painting.medium}
                  onChange={(e) =>
                    handleFieldChange(painting.id, "medium", e.target.value)
                  }
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-neutral-900">
                    Original details
                  </div>
                  <p className="text-xs text-neutral-700">
                    Status: {formatStatus(painting.status)}
                  </p>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-700">
                      Size (original)
                    </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={painting.size_original.split("x")[0]?.trim() || ""}
                    onChange={(e) => {
                      const parts = painting.size_original.split("x").map((p) => p.trim());
                      const height = parts[1] ?? "";
                      handleFieldChange(
                        painting.id,
                        "size_original",
                        `${e.target.value} x ${height}`
                      );
                    }}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="Width"
                    aria-label="Original width"
                  />
                  <input
                    value={painting.size_original.split("x")[1]?.trim() || ""}
                    onChange={(e) => {
                      const parts = painting.size_original.split("x").map((p) => p.trim());
                      const width = parts[0] ?? "";
                      handleFieldChange(
                        painting.id,
                        "size_original",
                        `${width} x ${e.target.value}`
                      );
                    }}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="Height"
                    aria-label="Original height"
                  />
                </div>
                    <label className="block text-xs font-medium text-neutral-700">
                      Price (original)
                    </label>
                    <input
                      value={painting.price_original}
                      onChange={(e) =>
                        handleFieldChange(
                          painting.id,
                          "price_original",
                          e.target.value
                        )
                      }
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-neutral-900">
                    Prints
                  </div>
                  <div className="space-y-2">
                    {painting.prints.map((pr) => {
                      const [width = "", height = ""] = pr.size
                        ? pr.size.split("x").map((s) => s.trim())
                        : ["", ""];
                      return (
                        <div
                          key={pr.id}
                          className="grid grid-cols-2 gap-2 text-sm items-start"
                        >
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-neutral-700">
                              Size
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                value={width}
                                onChange={(e) =>
                                  handlePrintChange(
                                    painting.id,
                                    pr.id,
                                    "size",
                                    `${e.target.value} x ${height}`
                                  )
                                }
                                className="w-full rounded border border-neutral-300 px-2 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                                aria-label="Print width"
                                placeholder="Width"
                              />
                              <input
                                value={height}
                                onChange={(e) =>
                                  handlePrintChange(
                                    painting.id,
                                    pr.id,
                                    "size",
                                    `${width} x ${e.target.value}`
                                  )
                                }
                                className="w-full rounded border border-neutral-300 px-2 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                                aria-label="Print height"
                                placeholder="Height"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-neutral-700">
                              Price
                            </div>
                            <input
                              value={pr.price}
                              onChange={(e) =>
                                handlePrintChange(
                                  painting.id,
                                  pr.id,
                                  "price",
                                  e.target.value
                                )
                              }
                              className="w-full rounded border border-neutral-300 px-2 py-2 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                              aria-label="Print price"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <Link
                  href="/app/dashboard/inventory"
                  className="inline-flex items-center justify-center rounded border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
                >
                  Manage inventory
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave(painting)}
              disabled={savingId === painting.id}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
            >
              {savingId === painting.id ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(painting.id)}
              disabled={deletingId === painting.id}
              className="rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            >
              {deletingId === painting.id ? "Deleting..." : "Delete painting"}
            </button>
            {message && <span className="text-sm text-neutral-700">{message}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
