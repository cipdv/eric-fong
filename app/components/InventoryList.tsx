"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addPrintInventoryAction,
  addPrintSizeAction,
  movePrintInventoryAction,
  removePrintInventoryAction,
  sellPrintInventoryAction,
  updatePrintLocationPriceAction,
} from "@/app/actions/inventory";
import { createLocation } from "@/app/actions/gallery";

type InventoryPrint = {
  id: string;
  size: string;
  price: number;
  quantity: number;
  location_stock: {
    location_id: string;
    location_name: string | null;
    quantity: number;
    commission_rate: number | null;
    price_override: number | null;
  }[];
};

type InventoryPainting = {
  id: string;
  title: string;
  image_url: string | null;
  prints: InventoryPrint[];
};

type LocationOption = {
  id: string;
  name: string;
};

type Props = {
  inventory: InventoryPainting[];
  locations: LocationOption[];
};

const removalReasons = [
  { value: "lost", label: "Lost" },
  { value: "damaged", label: "Damaged" },
  { value: "sold", label: "Sold" },
  { value: "no_reason", label: "No reason" },
  { value: "given_away", label: "Given away" },
];

type VariantCardProps = {
  print: InventoryPrint;
  locations: LocationOption[];
  formatMoney: (value: number) => string;
};

function VariantCard({ print, locations, formatMoney }: VariantCardProps) {
  const router = useRouter();
  const defaultLocationId = locations[0]?.id ?? "";
  const [locationPriceDrafts, setLocationPriceDrafts] = useState<
    Record<string, string>
  >({});
  const [addForm, setAddForm] = useState({
    quantity: "",
    locationId: defaultLocationId,
  });
  const [removeForm, setRemoveForm] = useState({
    quantity: "",
    locationId: defaultLocationId,
    reason: removalReasons[0].value,
    salePrice: "",
    commissionRate: "",
  });
  const [moveForm, setMoveForm] = useState({
    quantity: "",
    fromLocationId: defaultLocationId,
    toLocationId: defaultLocationId,
  });
  const [message, setMessage] = useState<
    { text: string; tone: "success" | "error" } | null
  >(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const locationRows = useMemo(() => {
    const map = new Map<
      string,
      {
        location_id: string;
        location_name: string;
        quantity: number;
        price_override: number | null;
      }
    >();
    locations.forEach((loc) => {
      map.set(loc.id, {
        location_id: loc.id,
        location_name: loc.name,
        quantity: 0,
        commission_rate: null,
        price_override: null,
      });
    });
    print.location_stock.forEach((loc) => {
      const existing = map.get(loc.location_id);
      if (existing) {
        existing.quantity = Number(loc.quantity ?? 0);
        existing.commission_rate =
          loc.commission_rate !== null && loc.commission_rate !== undefined
            ? loc.commission_rate
            : null;
        existing.price_override = loc.price_override ?? null;
      } else {
        map.set(loc.location_id, {
          location_id: loc.location_id,
          location_name: loc.location_name || "Unassigned",
          quantity: Number(loc.quantity ?? 0),
          commission_rate:
            loc.commission_rate !== null && loc.commission_rate !== undefined
              ? loc.commission_rate
              : null,
          price_override: loc.price_override ?? null,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.location_name.localeCompare(b.location_name)
    );
  }, [locations, print.location_stock]);
  const getOverrideValue = (locationId: string) => {
    const current = print.location_stock.find(
      (loc) => loc.location_id === locationId
    );
    return current?.price_override !== null && current?.price_override !== undefined
      ? String(current.price_override)
      : "";
  };

  const getLocationPriceDraft = (locationId: string) => {
    if (Object.prototype.hasOwnProperty.call(locationPriceDrafts, locationId)) {
      return locationPriceDrafts[locationId];
    }
    const override = getOverrideValue(locationId);
    return override !== "" ? override : String(print.price ?? "");
  };

  const getLocationCommission = (locationId: string) => {
    const match = locationRows.find((row) => row.location_id === locationId);
    return match?.commission_rate ?? 0;
  };

  const getProjectedQty = (locationId: string) =>
    Number(locationRows.find((row) => row.location_id === locationId)?.quantity ?? 0);
  const visibleRows = locationRows.filter(
    (row) => getProjectedQty(row.location_id) > 0
  );

  const totalProjected = locationRows.reduce(
    (sum, row) => sum + getProjectedQty(row.location_id),
    0
  );

  const queueAdd = async () => {
    const qty = Number(addForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setAdjustError("Enter a valid add quantity.");
      return;
    }
    setActionBusy(true);
    setAdjustError(null);
    setMessage(null);
    try {
      await addPrintInventoryAction({
        printId: print.id,
        quantity: qty,
        locationId: addForm.locationId,
      });
      setAddForm((prev) => ({ ...prev, quantity: "" }));
      setMessage({ text: "Inventory added.", tone: "success" });
      router.refresh();
    } catch (err) {
      setAdjustError(
        (err as Error)?.message || "Unable to add inventory."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const queueRemove = async () => {
    const qty = Number(removeForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setAdjustError("Enter a valid delete quantity.");
      return;
    }
    const available = getProjectedQty(removeForm.locationId);
    if (qty > available) {
      setAdjustError(`Only ${available} available at this location.`);
      return;
    }
    setActionBusy(true);
    setAdjustError(null);
    setMessage(null);
    try {
      if (removeForm.reason === "sold") {
        const unitPrice = Number(getLocationPriceDraft(removeForm.locationId));
        const computed = Number.isFinite(unitPrice) ? unitPrice * qty : 0;
        const totalPrice =
          removeForm.salePrice !== "" ? Number(removeForm.salePrice) : computed;
        if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
          throw new Error("Enter a valid sale price.");
        }
        const commissionRate =
          removeForm.commissionRate !== ""
            ? Number(removeForm.commissionRate)
            : getLocationCommission(removeForm.locationId);
        if (!Number.isFinite(commissionRate) || commissionRate < 0) {
          throw new Error("Enter a valid commission rate.");
        }
        await sellPrintInventoryAction({
          printId: print.id,
          quantity: qty,
          locationId: removeForm.locationId,
          totalPrice,
          commissionRate,
        });
      } else {
        await removePrintInventoryAction({
          printId: print.id,
          quantity: qty,
          reason: removeForm.reason,
          locationId: removeForm.locationId,
        });
      }
      setRemoveForm((prev) => ({ ...prev, quantity: "" }));
      setMessage({
        text:
          removeForm.reason === "sold"
            ? "Sale recorded."
            : "Inventory deleted.",
        tone: "success",
      });
      router.refresh();
    } catch (err) {
      setAdjustError(
        (err as Error)?.message || "Unable to delete inventory."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const queueMove = async () => {
    const qty = Number(moveForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setAdjustError("Enter a valid move quantity.");
      return;
    }
    if (moveForm.fromLocationId === moveForm.toLocationId) {
      setAdjustError("Select a different destination.");
      return;
    }
    const available = getProjectedQty(moveForm.fromLocationId);
    if (qty > available) {
      setAdjustError(`Only ${available} available at this location.`);
      return;
    }
    setActionBusy(true);
    setAdjustError(null);
    setMessage(null);
    try {
      await movePrintInventoryAction({
        printId: print.id,
        fromLocationId: moveForm.fromLocationId,
        toLocationId: moveForm.toLocationId,
        quantity: qty,
      });
      setMoveForm((prev) => ({ ...prev, quantity: "" }));
      setMessage({ text: "Inventory moved.", tone: "success" });
      router.refresh();
    } catch (err) {
      setAdjustError(
        (err as Error)?.message || "Unable to move inventory."
      );
    } finally {
      setActionBusy(false);
    }
  };


  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-neutral-900">
              {print.size || "Size N/A"}
            </div>
            <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-700">
              {totalProjected} available
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 text-xs text-neutral-700">
        <div className="grid grid-cols-[1.2fr_0.6fr_1fr] gap-2 bg-neutral-50 px-3 py-2 font-semibold text-neutral-600">
          <div>Location</div>
          <div>On hand</div>
          <div>Price</div>
        </div>
        <div className="divide-y divide-neutral-200">
          {visibleRows.map((row) => {
            const projectedQty = getProjectedQty(row.location_id);
            const overrideValue = getOverrideValue(row.location_id);
            const isOverride = overrideValue !== "";
            return (
              <div
                key={row.location_id}
                className="grid grid-cols-[1.2fr_0.6fr_1fr] gap-2 px-3 py-2"
              >
                <div className="font-semibold text-neutral-800">
                  {row.location_name}
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-neutral-900">
                    {projectedQty}
                  </div>
                </div>
                <div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={getLocationPriceDraft(row.location_id)}
                      onChange={(e) =>
                        setLocationPriceDrafts((prev) => ({
                          ...prev,
                          [row.location_id]: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={async () => {
                        const nextValue = getLocationPriceDraft(row.location_id);
                        setActionBusy(true);
                        setAdjustError(null);
                        setMessage(null);
                        try {
                          await updatePrintLocationPriceAction({
                            printId: print.id,
                            locationId: row.location_id,
                            priceOverride: nextValue,
                          });
                          setMessage({ text: "Location price updated.", tone: "success" });
                          router.refresh();
                        } catch (err) {
                          setAdjustError(
                            (err as Error)?.message || "Unable to update location price."
                          );
                        } finally {
                          setActionBusy(false);
                        }
                      }}
                      className="rounded border border-neutral-300 px-2 py-1 text-[11px] font-semibold text-neutral-700 disabled:opacity-60"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {visibleRows.length === 0 ? (
            <div className="px-3 py-3 text-xs text-neutral-500">
              No locations yet.
            </div>
          ) : null}
        </div>
      </div>

      {adjustError ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {adjustError}
        </div>
      ) : null}
      {message ? (
        <div
          className={`mt-3 rounded border px-3 py-2 text-xs ${
            message.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <details className="rounded border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-neutral-900">
            <span>Add inventory</span>
            <span className="text-[10px] text-neutral-500">Expand</span>
          </summary>
          <div className="mt-2 grid gap-2">
            <input
              type="number"
              min="1"
              placeholder="Qty"
              value={addForm.quantity}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, quantity: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
            <select
              value={addForm.locationId || defaultLocationId}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, locationId: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={queueAdd}
              disabled={actionBusy}
              className="rounded bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </details>

        <details className="rounded border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-neutral-900">
            <span>Delete inventory</span>
            <span className="text-[10px] text-neutral-500">Expand</span>
          </summary>
          <div className="mt-2 grid gap-2">
            <input
              type="number"
              min="1"
              placeholder="Qty"
              value={removeForm.quantity}
              onChange={(e) =>
                setRemoveForm((prev) => ({ ...prev, quantity: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
            <select
              value={removeForm.locationId || defaultLocationId}
              onChange={(e) =>
                setRemoveForm((prev) => ({
                  ...prev,
                  locationId: e.target.value,
                  commissionRate: String(getLocationCommission(e.target.value) || 0),
                }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            >
              {locationRows
                .filter((row) => row.quantity > 0)
                .map((row) => (
                  <option key={row.location_id} value={row.location_id}>
                    {row.location_name}
                  </option>
                ))}
            </select>
            <select
              value={removeForm.reason}
              onChange={(e) =>
                setRemoveForm((prev) => ({
                  ...prev,
                  reason: e.target.value,
                  salePrice: prev.salePrice,
                  commissionRate:
                    e.target.value === "sold"
                      ? String(getLocationCommission(prev.locationId) || 0)
                      : prev.commissionRate,
                }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            >
              {removalReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
            {removeForm.reason === "sold" ? (
              <input
                type="number"
                min="0"
                step="0.1"
                value={removeForm.commissionRate}
                onChange={(e) =>
                  setRemoveForm((prev) => ({
                    ...prev,
                    commissionRate: e.target.value,
                  }))
                }
                placeholder="Commission %"
                className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            ) : null}
            {removeForm.reason === "sold" ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={removeForm.salePrice}
                onChange={(e) =>
                  setRemoveForm((prev) => ({
                    ...prev,
                    salePrice: e.target.value,
                  }))
                }
                placeholder={String(
                  Number(getLocationPriceDraft(removeForm.locationId) || 0) *
                    Number(removeForm.quantity || 0)
                )}
                className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            ) : null}
            <button
              type="button"
              onClick={queueRemove}
              disabled={actionBusy}
              className="rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
            >
              {removeForm.reason === "sold" ? "Mark as sold" : "Delete"}
            </button>
          </div>
        </details>

        <details className="rounded border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-neutral-900">
            <span>Move inventory</span>
            <span className="text-[10px] text-neutral-500">Expand</span>
          </summary>
          <div className="mt-2 grid gap-2">
            <input
              type="number"
              min="1"
              placeholder="Qty"
              value={moveForm.quantity}
              onChange={(e) =>
                setMoveForm((prev) => ({ ...prev, quantity: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
            <select
              value={moveForm.fromLocationId || defaultLocationId}
              onChange={(e) =>
                setMoveForm((prev) => ({
                  ...prev,
                  fromLocationId: e.target.value,
                }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            >
              {locationRows
                .filter((row) => row.quantity > 0)
                .map((row) => (
                  <option key={row.location_id} value={row.location_id}>
                    From: {row.location_name}
                  </option>
                ))}
            </select>
            <select
              value={moveForm.toLocationId || defaultLocationId}
              onChange={(e) =>
                setMoveForm((prev) => ({
                  ...prev,
                  toLocationId: e.target.value,
                }))
              }
              className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  To: {loc.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={queueMove}
              disabled={actionBusy}
              className="rounded border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-60"
            >
              Move
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
export default function InventoryList({ inventory, locations }: Props) {
  const [selectedPrintByPainting, setSelectedPrintByPainting] = useState<
    Record<string, string>
  >({});
  const [newPrintForm, setNewPrintForm] = useState<{
    paintingId: string;
    width: string;
    height: string;
    price: string;
    quantity: string;
    locationId: string;
  }>({
    paintingId: "",
    width: "",
    height: "",
    price: "",
    quantity: "",
    locationId: "",
  });
  const [newPrintMessage, setNewPrintMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationNotes, setNewLocationNotes] = useState("");
  const [newLocationAddress1, setNewLocationAddress1] = useState("");
  const [newLocationAddress2, setNewLocationAddress2] = useState("");
  const [newLocationCity, setNewLocationCity] = useState("");
  const [newLocationProvince, setNewLocationProvince] = useState("");
  const [newLocationPostal, setNewLocationPostal] = useState("");
  const [newLocationCountry, setNewLocationCountry] = useState("");
  const [newLocationContactName, setNewLocationContactName] = useState("");
  const [newLocationContactPhone, setNewLocationContactPhone] = useState("");
  const [newLocationContactEmail, setNewLocationContactEmail] = useState("");
  const [newLocationCommissionRate, setNewLocationCommissionRate] = useState("");
  const [addingLocation, setAddingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const router = useRouter();

  const defaultLocationId = locations[0]?.id ?? "";
  const defaultPaintingId = inventory[0]?.id ?? "";

  const formatMoney = (value: number) =>
    Number(value ?? 0).toLocaleString("en-CA", {
      style: "currency",
      currency: "CAD",
    });

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) {
      setLocationMessage({ text: "Location name is required.", tone: "error" });
      return;
    }
    setAddingLocation(true);
    setLocationMessage(null);
    try {
      await createLocation({
        name: newLocationName,
        notes: newLocationNotes || null,
        address_line1: newLocationAddress1 || null,
        address_line2: newLocationAddress2 || null,
        city: newLocationCity || null,
        province: newLocationProvince || null,
        postal: newLocationPostal || null,
        country: newLocationCountry || null,
        contact_name: newLocationContactName || null,
        contact_phone: newLocationContactPhone || null,
        contact_email: newLocationContactEmail || null,
        commission_rate:
          newLocationCommissionRate.trim() === ""
            ? null
            : Number(newLocationCommissionRate),
      });
      setNewLocationName("");
      setNewLocationNotes("");
      setNewLocationAddress1("");
      setNewLocationAddress2("");
      setNewLocationCity("");
      setNewLocationProvince("");
      setNewLocationPostal("");
      setNewLocationCountry("");
      setNewLocationContactName("");
      setNewLocationContactPhone("");
      setNewLocationContactEmail("");
      setNewLocationCommissionRate("");
      setLocationMessage({ text: "Location added.", tone: "success" });
      router.refresh();
    } catch (err) {
      setLocationMessage({
        text: (err as Error)?.message || "Unable to add location.",
        tone: "error",
      });
    } finally {
      setAddingLocation(false);
    }
  };

  if (!inventory.length) {
    return <p className="text-sm text-neutral-700">No inventory yet.</p>;
  }

  return (
    <div className="space-y-4">
      <details className="rounded-lg border border-dashed border-neutral-300 bg-white p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-neutral-800">
          <span>Add new prints</span>
          <span className="text-xs text-neutral-500">Expand</span>
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr_auto]">
          <select
            value={newPrintForm.paintingId || defaultPaintingId}
            onChange={(e) =>
              setNewPrintForm((prev) => ({
                ...prev,
                paintingId: e.target.value,
              }))
            }
            className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
          >
            {inventory.map((painting) => (
              <option key={painting.id} value={painting.id}>
                {painting.title || "Untitled"}
              </option>
            ))}
          </select>
          <input
            placeholder="Width"
            value={newPrintForm.width}
            onChange={(e) =>
              setNewPrintForm((prev) => ({
                ...prev,
                width: e.target.value,
              }))
            }
            className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
          />
          <input
            placeholder="Height"
            value={newPrintForm.height}
            onChange={(e) =>
              setNewPrintForm((prev) => ({
                ...prev,
                height: e.target.value,
              }))
            }
            className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
          />
          <input
            placeholder="Price"
            type="number"
            min="0"
            value={newPrintForm.price}
            onChange={(e) =>
              setNewPrintForm((prev) => ({
                ...prev,
                price: e.target.value,
              }))
            }
            className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
          />
          <input
            placeholder="Qty"
            type="number"
            min="0"
            value={newPrintForm.quantity}
            onChange={(e) =>
              setNewPrintForm((prev) => ({
                ...prev,
                quantity: e.target.value,
              }))
            }
            className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
          />
          <select
            value={newPrintForm.locationId || defaultLocationId}
            onChange={(e) =>
              setNewPrintForm((prev) => ({
                ...prev,
                locationId: e.target.value,
              }))
            }
            className="w-full rounded border border-neutral-300 px-2 py-2 text-sm"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={workingId === "new-print"}
            onClick={async () => {
              const paintingId = newPrintForm.paintingId || defaultPaintingId;
              if (!paintingId) {
                setNewPrintMessage({
                  text: "Select a painting before adding prints.",
                  tone: "error",
                });
                return;
              }
              if (!newPrintForm.width || !newPrintForm.height || !newPrintForm.price) {
                setNewPrintMessage({
                  text: "Width, height, and price are required for new prints.",
                  tone: "error",
                });
                return;
              }
              const size = `${newPrintForm.width} x ${newPrintForm.height}`;
              setWorkingId("new-print");
              setNewPrintMessage(null);
              try {
                await addPrintSizeAction({
                  paintingId,
                  size,
                  price: newPrintForm.price,
                  initialQuantity: newPrintForm.quantity || 0,
                  locationId: newPrintForm.locationId || defaultLocationId,
                });
                setNewPrintForm((prev) => ({
                  ...prev,
                  width: "",
                  height: "",
                  price: "",
                  quantity: "",
                  locationId: defaultLocationId,
                }));
                setNewPrintMessage({
                  text: "New print size added.",
                  tone: "success",
                });
                router.refresh();
              } catch (err) {
                setNewPrintMessage({
                  text: (err as Error).message,
                  tone: "error",
                });
              } finally {
                setWorkingId(null);
              }
            }}
            className="rounded bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            Add prints
          </button>
        </div>
        {newPrintMessage?.text ? (
          <div
            className={`mt-2 rounded border px-3 py-2 text-xs ${
              newPrintMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {newPrintMessage.text}
          </div>
        ) : null}
      </details>
      <details className="rounded-lg border border-dashed border-neutral-300 bg-white p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-neutral-800">
          <span>Add new location</span>
          <span className="text-xs text-neutral-500">Expand</span>
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="Location name"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              value={newLocationNotes}
              onChange={(e) => setNewLocationNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <input
              value={newLocationAddress1}
              onChange={(e) => setNewLocationAddress1(e.target.value)}
              placeholder="Address line 1"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              value={newLocationAddress2}
              onChange={(e) => setNewLocationAddress2(e.target.value)}
              placeholder="Address line 2"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={newLocationCity}
                onChange={(e) => setNewLocationCity(e.target.value)}
                placeholder="City"
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                value={newLocationProvince}
                onChange={(e) => setNewLocationProvince(e.target.value)}
                placeholder="Province/State"
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={newLocationPostal}
                onChange={(e) => setNewLocationPostal(e.target.value)}
                placeholder="Postal/Zip"
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                value={newLocationCountry}
                onChange={(e) => setNewLocationCountry(e.target.value)}
                placeholder="Country"
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={newLocationContactName}
              onChange={(e) => setNewLocationContactName(e.target.value)}
              placeholder="Contact name"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              value={newLocationContactPhone}
              onChange={(e) => setNewLocationContactPhone(e.target.value)}
              placeholder="Contact phone"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={newLocationContactEmail}
              onChange={(e) => setNewLocationContactEmail(e.target.value)}
              placeholder="Contact email"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="1"
              value={newLocationCommissionRate}
              onChange={(e) => setNewLocationCommissionRate(e.target.value)}
              placeholder="Commission %"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddLocation}
              disabled={addingLocation}
              className="rounded bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {addingLocation ? "Saving..." : "Save location"}
            </button>
            {locationMessage ? (
              <span
                className={`text-xs ${
                  locationMessage.tone === "success"
                    ? "text-emerald-700"
                    : "text-red-700"
                }`}
              >
                {locationMessage.text}
              </span>
            ) : null}
          </div>
        </div>
      </details>
      {inventory.map((painting) => (
        <div
          key={painting.id}
          className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
              {painting.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={painting.image_url}
                  alt={painting.title || "Painting"}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-neutral-900">
                {painting.title || "Untitled"}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span>
                  {painting.prints.length} print
                  {painting.prints.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {painting.prints.length === 0 ? (
              <p className="text-sm text-neutral-600">No prints for this painting.</p>
            ) : (
              <>
                <div className="max-w-xs">
                  <select
                    value={
                      selectedPrintByPainting[painting.id] ||
                      painting.prints[0]?.id ||
                      ""
                    }
                    onChange={(e) =>
                      setSelectedPrintByPainting((prev) => ({
                        ...prev,
                        [painting.id]: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  >
                    {painting.prints.map((print) => (
                      <option key={print.id} value={print.id}>
                        {print.size || "Size N/A"}
                      </option>
                    ))}
                  </select>
                </div>
                {(selectedPrintByPainting[painting.id]
                  ? painting.prints.find(
                      (print) => print.id === selectedPrintByPainting[painting.id]
                    )
                  : painting.prints[0]
                ) ? (
                  <VariantCard
                    print={
                      selectedPrintByPainting[painting.id]
                        ? painting.prints.find(
                            (print) =>
                              print.id === selectedPrintByPainting[painting.id]
                          ) || painting.prints[0]
                        : painting.prints[0]
                    }
                    locations={locations}
                    formatMoney={formatMoney}
                  />
                ) : null}
              </>
            )}

          </div>
        </div>
      ))}
    </div>
  );
}
