"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  adjustPrintInventoryAction,
  createLocation,
  deletePaintingAction,
  markPaintingSoldAction,
  removeLocationAction,
  unsellPaintingAction,
  updateGalleryOrderAction,
  updateLocationAction,
  updatePaintingAction,
} from "@/app/actions/gallery";

type Print = {
  id: string;
  size: string;
  price: string;
  quantity: number;
  location_stock?: {
    location_id: string;
    location_name: string | null;
    quantity: number;
  }[];
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
  is_home_page?: boolean | null;
  include_in_gallery?: boolean | null;
  status?: string;
  sale_order_id?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  location_start_date?: string | null;
  location_end_date?: string | null;
  location_commission_rate?: string | null;
  sold_customer_name?: string | null;
  sold_price?: string | null;
};

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

function stripInches(value: string) {
  return value.replace(/\s*(inches?|in\.?)$/i, "").trim();
}

type Props = {
  paintings: Painting[];
  locations: LocationOption[];
};

function idToString(v: unknown) {
  return v === null || v === undefined ? "" : String(v);
}

function moveItem<T>(list: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, option, button, a, label, [contenteditable='true']"
    )
  );
}

export default function GalleryEditor({ paintings, locations }: Props) {
  const [items, setItems] = useState(paintings);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>(locations);
  const [homeId, setHomeId] = useState<string | null>(
    paintings.find((p) => p.is_home_image || p.is_home_page)?.id ?? null
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [retrievingId, setRetrievingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [updatingQtyId, setUpdatingQtyId] = useState<string | null>(null);
  const [activeInventoryPrintId, setActiveInventoryPrintId] = useState<string | null>(null);
  const [inventoryMode, setInventoryMode] = useState<"add" | "remove">("add");
  const [inventoryReason, setInventoryReason] = useState("manual_add");
  const [inventoryQty, setInventoryQty] = useState("");
  const [inventoryLocationId, setInventoryLocationId] = useState<string | null>(
    locations[0]?.id ?? null
  );
  const [activeSoldPaintingId, setActiveSoldPaintingId] = useState<string | null>(null);
  const [soldDetails, setSoldDetails] = useState<
    Record<
      string,
      {
        customerFirstName: string;
        customerLastName: string;
        customerEmail: string;
        customerPhone: string;
        shipAddress1: string;
        shipAddress2: string;
        shipCity: string;
        shipProvince: string;
        shipPostal: string;
        shipCountry: string;
        pricePaid: string;
      }
    >
  >({});
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);
  const [savingSold, setSavingSold] = useState(false);
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
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState(false);
  const [locationTab, setLocationTab] = useState<"add" | "edit">("add");
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);
  const [expandedPaintingId, setExpandedPaintingId] = useState<string | null>(null);
  const [editLocationId, setEditLocationId] = useState<string | null>(
    locations[0]?.id ?? null
  );
  const [editLocationName, setEditLocationName] = useState("");
  const [editLocationNotes, setEditLocationNotes] = useState("");
  const [editLocationAddress1, setEditLocationAddress1] = useState("");
  const [editLocationAddress2, setEditLocationAddress2] = useState("");
  const [editLocationCity, setEditLocationCity] = useState("");
  const [editLocationProvince, setEditLocationProvince] = useState("");
  const [editLocationPostal, setEditLocationPostal] = useState("");
  const [editLocationCountry, setEditLocationCountry] = useState("");
  const [editLocationContactName, setEditLocationContactName] = useState("");
  const [editLocationContactPhone, setEditLocationContactPhone] = useState("");
  const [editLocationContactEmail, setEditLocationContactEmail] = useState("");
  const [editLocationCommissionRate, setEditLocationCommissionRate] = useState("");
  const toggleLocationCard = (
    e: React.MouseEvent | React.KeyboardEvent
  ) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-stop-toggle="true"]')) return;
    setShowLocationForm((prev) => !prev);
  };
  const router = useRouter();
  const pathname = usePathname();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);
  const soldModalRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionRef = useRef<number | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const previousPositions = useRef<Map<string, DOMRect>>(new Map());
  const initialOrder = useRef<string[]>([]);
  const itemsRef = useRef(items);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const lastDragTargetRef = useRef<string | null>(null);
  const isGalleryRoute = pathname?.startsWith("/app/dashboard/gallery");
  const hasOpenModal =
    isGalleryRoute &&
    (Boolean(activeInventoryPrintId) || Boolean(activeSoldPaintingId));

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const flagged = items
      .filter((p) => p.is_home_image || p.is_home_page)
      .map((p) => ({ id: p.id, is_home_image: p.is_home_image, is_home_page: p.is_home_page }));
    // Debug for homepage selection
    console.log("[GalleryEditor] homeId", homeId, { items: items.length, flagged });
    console.log("[GalleryEditor] first item sample", items[0]);
  }, [homeId, items]);

  useEffect(() => {
    const merged = [...locations];
    merged.sort((a, b) => a.name.localeCompare(b.name));
    setLocationOptions(merged);
  }, [locations]);

  useEffect(() => {
    if (!editLocationId && locationOptions[0]?.id) {
      setEditLocationId(locationOptions[0].id);
    }
  }, [editLocationId, locationOptions]);

  useEffect(() => {
    if (!editLocationId) return;
    const selected = locationOptions.find(
      (loc) => idToString(loc.id) === idToString(editLocationId)
    );
    if (!selected) return;
    setEditLocationName(selected.name ?? "");
    setEditLocationNotes(selected.notes ?? "");
    setEditLocationAddress1(selected.address_line1 ?? "");
    setEditLocationAddress2(selected.address_line2 ?? "");
    setEditLocationCity(selected.city ?? "");
    setEditLocationProvince(selected.province ?? "");
    setEditLocationPostal(selected.postal ?? "");
    setEditLocationCountry(selected.country ?? "");
    setEditLocationContactName(selected.contact_name ?? "");
    setEditLocationContactPhone(selected.contact_phone ?? "");
    setEditLocationContactEmail(selected.contact_email ?? "");
    setEditLocationCommissionRate(
      selected.commission_rate !== null && selected.commission_rate !== undefined
        ? String(selected.commission_rate)
        : ""
    );
  }, [editLocationId, locationOptions]);

  useEffect(() => {
    if (!inventoryLocationId && locationOptions[0]?.id) {
      setInventoryLocationId(locationOptions[0].id);
    }
  }, [inventoryLocationId, locationOptions]);

  useEffect(() => {
    if (!activeInventoryPrintId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveInventoryPrintId(null);
        setInventoryQty("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeInventoryPrintId]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    if (hasOpenModal) {
      document.body.style.overflow = "hidden";
      // Prevent layout shift when scrollbar disappears
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
    } else {
      document.body.style.overflow = prevOverflow || "";
      document.body.style.paddingRight = prevPadding || "";
    }
    return () => {
      document.body.style.overflow = prevOverflow || "";
      document.body.style.paddingRight = prevPadding || "";
    };
  }, [hasOpenModal]);

  useEffect(() => {
    if (!activeSoldPaintingId) return;
    // Scroll the viewport to center the sold modal in view.
    window.requestAnimationFrame(() => {
      soldModalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [activeSoldPaintingId]);

  useEffect(() => {
    if (activeSoldPaintingId) {
      if (scrollPositionRef.current === null) {
        scrollPositionRef.current = window.scrollY;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (scrollPositionRef.current !== null) {
      window.scrollTo({ top: scrollPositionRef.current, behavior: "smooth" });
      scrollPositionRef.current = null;
    }
  }, [activeSoldPaintingId]);

  const handleFieldChange = (
    paintingId: string,
    field: keyof Painting,
    value: string | boolean | null
  ) => {
    setItems((prev) =>
      prev.map((p) => (p.id === paintingId ? { ...p, [field]: value } : p))
    );
  };

  const handleLocationChange = (paintingId: string, locationId: string | null) => {
    const selected =
      locationOptions.find((loc) => idToString(loc.id) === idToString(locationId)) || null;
    const commissionValue =
      selected?.commission_rate === null || selected?.commission_rate === undefined
        ? null
        : String(selected.commission_rate);
    setItems((prev) =>
      prev.map((p) =>
        p.id === paintingId
          ? {
              ...p,
              location_id: locationId,
              location_name: selected?.name ?? null,
              location_commission_rate: locationId ? commissionValue : null,
            }
          : p
      )
    );
  };

  const persistReorder = async (orderedIds: string[]) => {
    if (reordering) return;
    setReordering(true);
    setMessage(null);
    try {
      await updateGalleryOrderAction({ orderedIds });
      setMessage("Gallery order updated.");
      setTimeout(() => setMessage(null), 2000);
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
      setItems((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        return initialOrder.current.map((id) => byId.get(id)!).filter(Boolean);
      });
    } finally {
      setReordering(false);
    }
  };

  const handleAddLocation = async () => {
    const name = newLocationName.trim();
    if (!name) {
      setMessage("Location name is required.");
      return;
    }
    const commission = newLocationCommissionRate.trim();
    const commissionValue =
      commission === "" ? undefined : Number.isFinite(Number(commission)) ? Number(commission) : null;
    setAddingLocation(true);
    setMessage(null);
    setLocationFeedback(null);
    try {
      const created = await createLocation({
        name,
        notes: newLocationNotes.trim() || null,
        address_line1: newLocationAddress1.trim() || null,
        address_line2: newLocationAddress2.trim() || null,
        city: newLocationCity.trim() || null,
        province: newLocationProvince.trim() || null,
        postal: newLocationPostal.trim() || null,
        country: newLocationCountry.trim() || null,
        contact_name: newLocationContactName.trim() || null,
        contact_phone: newLocationContactPhone.trim() || null,
        contact_email: newLocationContactEmail.trim() || null,
        commission_rate: commissionValue ?? null,
      });
      const createdOption: LocationOption = {
        id: String(created.id),
        name: created.name ?? name,
        notes: created.notes ?? null,
        address_line1: created.address_line1 ?? null,
        address_line2: created.address_line2 ?? null,
        city: created.city ?? null,
        province: created.province ?? null,
        postal: created.postal ?? null,
        country: created.country ?? null,
        contact_name: created.contact_name ?? null,
        contact_phone: created.contact_phone ?? null,
        contact_email: created.contact_email ?? null,
        start_date: created.start_date ?? null,
        end_date: created.end_date ?? null,
        commission_rate: created.commission_rate ?? null,
      };
      setLocationOptions((prev) => {
        const exists = prev.find((loc) => loc.id === createdOption.id);
        const next = exists ? [...prev] : [...prev, createdOption];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
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
      setInventoryLocationId((prev) => prev || createdOption.id);
      router.refresh();
      setLocationFeedback("Location added.");
      setTimeout(() => setLocationFeedback(null), 2500);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setAddingLocation(false);
    }
  };

  useEffect(() => {
    setItems(paintings);
    setHomeId(paintings.find((p) => p.is_home_image || p.is_home_page)?.id ?? null);
  }, [paintings]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useLayoutEffect(() => {
    const nextPositions = new Map<string, DOMRect>();
    for (const item of items) {
      const el = itemRefs.current.get(item.id);
      if (!el) continue;
      nextPositions.set(item.id, el.getBoundingClientRect());
    }

    if (previousPositions.current.size) {
      for (const [id, nextRect] of nextPositions.entries()) {
        const prevRect = previousPositions.current.get(id);
        if (!prevRect) continue;
        const dx = prevRect.left - nextRect.left;
        const dy = prevRect.top - nextRect.top;
        if (!dx && !dy) continue;
        const el = itemRefs.current.get(id);
        if (!el) continue;
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 200ms cubic-bezier(0.2, 0, 0.2, 1)";
          el.style.transform = "";
        });
      }
    }

    previousPositions.current = nextPositions;
  }, [items]);

  useEffect(() => {
    if (!draggingId) return;
    const onPointerMove = (event: PointerEvent) => {
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
      if (dragRafRef.current !== null) return;
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null;
        if (!dragPointerRef.current) return;
        const { x, y } = dragPointerRef.current;
        const viewportHeight = window.innerHeight;
        const edgeThreshold = 90;
        if (y < edgeThreshold) {
          const strength = (edgeThreshold - y) / edgeThreshold;
          window.scrollBy({ top: -Math.ceil(16 * strength), behavior: "auto" });
        } else if (y > viewportHeight - edgeThreshold) {
          const strength = (y - (viewportHeight - edgeThreshold)) / edgeThreshold;
          window.scrollBy({ top: Math.ceil(16 * strength), behavior: "auto" });
        }

        const element = document.elementFromPoint(x, y);
        const target = element?.closest?.("[data-painting-id]") as HTMLElement | null;
        const targetId = target?.dataset?.paintingId || null;
        if (!targetId || targetId === draggingId) return;
        if (lastDragTargetRef.current === targetId) return;
        lastDragTargetRef.current = targetId;
        setDragOverId(targetId);
        setItems((prev) => {
          const fromIndex = prev.findIndex((p) => p.id === draggingId);
          const toIndex = prev.findIndex((p) => p.id === targetId);
          if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
          return moveItem(prev, fromIndex, toIndex);
        });
      });
    };

    const onPointerUp = () => {
      const finalOrder = itemsRef.current.map((item) => item.id);
      setDraggingId(null);
      setDragOverId(null);
      lastDragTargetRef.current = null;
      dragPointerRef.current = null;
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (initialOrder.current.join("|") !== finalOrder.join("|")) {
        void persistReorder(finalOrder);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [draggingId]);

  const handleStatusChange = async (paintingId: string, nextStatus: string) => {
    const current = items.find((p) => p.id === paintingId);
    if (current?.status === "sold" && nextStatus !== "sold") {
      const confirmed = confirm(
        'Reverting from "Sold" will delete the associated sale order. Continue?'
      );
      if (!confirmed) return;
      const orderId = current?.sale_order_id?.toString() || "";
      setMessage(null);
      try {
        await unsellPaintingAction({
          paintingId,
          nextStatus,
          orderId: orderId || null,
        });
        handleFieldChange(paintingId, "status", nextStatus);
        setSoldDetails((prev) => {
          const next = { ...prev };
          delete next[paintingId];
          return next;
        });
        setMessage("Sale record removed.");
        setTimeout(() => setMessage(null), 2000);
        router.refresh();
      } catch (err) {
        setMessage((err as Error).message);
      }
      return;
    }
    if (nextStatus === "sold") {
      setPreviousStatus(current?.status ?? "");
      setActiveSoldPaintingId(paintingId);
      setSoldDetails((prev) => ({
        ...prev,
        [paintingId]: prev[paintingId] || {
          customerFirstName: "",
          customerLastName: "",
          customerEmail: "",
          customerPhone: "",
          shipAddress1: "",
          shipAddress2: "",
          shipCity: "",
          shipProvince: "",
          shipPostal: "",
          shipCountry: "",
          pricePaid: "",
        },
      }));
      return;
    }
    handleFieldChange(paintingId, "status", nextStatus);
  };

  const handleInventoryAdjust = async () => {
    if (!activeInventoryPrintId) return;
    const qty = Math.max(1, Math.floor(Number(inventoryQty) || 0));
    if (!qty) return;
    const selectedLocationId = inventoryLocationId || locationOptions[0]?.id || null;
    const locationName =
      locationOptions.find((loc) => loc.id === selectedLocationId)?.name ?? null;
    if (!selectedLocationId) {
      setMessage("Add a location first.");
      return;
    }
    const isRemove = inventoryMode === "remove";
    const body =
      isRemove && qty > 0
        ? {
            removeQuantity: qty,
            reason: inventoryReason || "manual_adjust",
            locationId: selectedLocationId,
          }
        : {
            addQuantity: qty,
            reason: inventoryReason || "manual_add",
            locationId: selectedLocationId,
          };

    setUpdatingQtyId(activeInventoryPrintId);
    setMessage(null);
    try {
      const data = await adjustPrintInventoryAction({
        printId: activeInventoryPrintId,
        addQuantity: body.addQuantity,
        removeQuantity: body.removeQuantity,
        reason: body.reason,
        locationId: selectedLocationId,
      });
      const nextQty = Number(data.quantity ?? 0);
      const nextLocationQty = Number(data.locationQuantity ?? qty);
      const normalizedLocationId = data.locationId?.toString() || selectedLocationId;
      setItems((prev) =>
        prev.map((p) => ({
          ...p,
          prints: p.prints.map((pr) =>
            pr.id === activeInventoryPrintId
              ? {
                  ...pr,
                  quantity: nextQty,
                  location_stock: (() => {
                    const current = pr.location_stock ? [...pr.location_stock] : [];
                    const existingIndex = current.findIndex(
                      (loc) => loc.location_id === normalizedLocationId
                    );
                    if (existingIndex >= 0) {
                      current[existingIndex] = {
                        ...current[existingIndex],
                        quantity: nextLocationQty,
                      };
                    } else {
                      current.push({
                        location_id: normalizedLocationId,
                        location_name: locationName,
                        quantity: nextLocationQty,
                      });
                    }
                    return current;
                  })(),
                }
              : pr
          ),
        }))
      );
      setInventoryQty("");
      setActiveInventoryPrintId(null);
      setMessage("Inventory updated.");
      setTimeout(() => setMessage(null), 2000);
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setUpdatingQtyId(null);
    }
  };

  const handleSave = async (painting: Painting) => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[GalleryEditor] handleSave", {
        id: painting.id,
        location_id: painting.location_id,
        location_name: painting.location_name,
      });
    }
    setSavingId(painting.id);
    setMessage(null);
    try {
      await updatePaintingAction({
        paintingId: painting.id,
        title: painting.title,
        details: painting.details,
        medium: painting.medium,
        size_original: painting.size_original,
        price_original: painting.price_original,
        location_id: painting.location_id ?? null,
        location_start_date: painting.location_start_date ?? null,
        location_end_date: painting.location_end_date ?? null,
        location_commission_rate: painting.location_commission_rate ?? null,
        prints: painting.prints.map((pr) => ({
          id: pr.id,
          price: pr.price,
          size: pr.size,
        })),
        is_home_image: homeId === painting.id,
        include_in_gallery: painting.include_in_gallery ?? true,
      });
      setMessage("Saved.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateLocation = async () => {
    if (!editLocationId) return;
    const name = editLocationName.trim();
    if (!name) {
      setMessage("Location name is required.");
      return;
    }
    const commission = editLocationCommissionRate.trim();
    const commissionValue =
      commission === ""
        ? undefined
        : Number.isFinite(Number(commission))
          ? Number(commission)
          : null;
    setUpdatingLocation(true);
    setMessage(null);
    setLocationFeedback(null);
    try {
      await updateLocationAction({
        locationId: editLocationId,
        name,
        notes: editLocationNotes.trim() || null,
        address_line1: editLocationAddress1.trim() || null,
        address_line2: editLocationAddress2.trim() || null,
        city: editLocationCity.trim() || null,
        province: editLocationProvince.trim() || null,
        postal: editLocationPostal.trim() || null,
        country: editLocationCountry.trim() || null,
        contact_name: editLocationContactName.trim() || null,
        contact_phone: editLocationContactPhone.trim() || null,
        contact_email: editLocationContactEmail.trim() || null,
        commission_rate: commissionValue ?? null,
      });
      setLocationFeedback("Location updated.");
      setTimeout(() => setLocationFeedback(null), 2500);
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!editLocationId) return;
    if (editLocationName.trim().toLowerCase() === "online shop") {
      setMessage('The "Online shop" location cannot be removed.');
      return;
    }
    if (!confirm("Remove this location? It will no longer appear in lists.")) return;
    setDeletingLocation(true);
    setMessage(null);
    setLocationFeedback(null);
    try {
      await removeLocationAction(editLocationId);
      setLocationFeedback("Location removed.");
      setTimeout(() => setLocationFeedback(null), 2500);
      setEditLocationId(null);
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setDeletingLocation(false);
    }
  };

  const handleMarkRetrieved = async (paintingId: string) => {
    const painting = items.find((item) => item.id === paintingId);
    if (!painting) return;
    setRetrievingId(paintingId);
    setMessage(null);
    try {
      await updatePaintingAction({
        paintingId: painting.id,
        title: painting.title,
        details: painting.details,
        medium: painting.medium,
        size_original: painting.size_original,
        price_original: painting.price_original,
        location_id: null,
        location_start_date: null,
        location_end_date: null,
        location_commission_rate: null,
        prints: painting.prints.map((pr) => ({
          id: pr.id,
          price: pr.price,
          size: pr.size,
        })),
        is_home_image: homeId === painting.id,
        include_in_gallery: painting.include_in_gallery ?? true,
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === paintingId
            ? {
                ...item,
                location_id: null,
                location_name: null,
                location_start_date: null,
                location_end_date: null,
                location_commission_rate: null,
              }
            : item
        )
      );
      setMessage("Location cleared.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setRetrievingId(null);
    }
  };

  const handleDelete = async (paintingId: string) => {
    if (!confirm("Delete this painting? This cannot be undone.")) return;
    setDeletingId(paintingId);
    setMessage(null);
    try {
      await deletePaintingAction(paintingId);
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

  const formatMoney = (value: string | number | null | undefined) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return num.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
  };

  const todayString = (() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${month}-${day}`;
  })();

  const isDateBeforeToday = (value?: string | null) => {
    if (!value) return false;
    return value < todayString;
  };

  const normalizeDateInput = (value?: string | null) => {
    if (!value) return "";
    if (value.includes("T")) return value.split("T")[0];
    if (value.includes(" ")) return value.split(" ")[0];
    return value;
  };

  const activeSoldPainting = activeSoldPaintingId
    ? items.find((p) => p.id === activeSoldPaintingId) || null
    : null;

  return (
    <div className="space-y-6">
      <div
        className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={showLocationForm}
        onClick={toggleLocationCard}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (e.currentTarget !== e.target) return;
            e.preventDefault();
            toggleLocationCard(e);
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold text-neutral-900">Locations</div>
        </div>
        {locationFeedback && (
          <div className="mt-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            {locationFeedback}
          </div>
        )}
        {showLocationForm ? (
          <div
            className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-4 cursor-default"
            data-stop-toggle="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLocationTab("add")}
                className={`rounded px-3 py-1.5 text-sm font-semibold transition ${
                  locationTab === "add"
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                Add new location
              </button>
              <button
                type="button"
                onClick={() => setLocationTab("edit")}
                className={`rounded px-3 py-1.5 text-sm font-semibold transition ${
                  locationTab === "edit"
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                Edit locations
              </button>
            </div>

            {locationTab === "add" ? (
              <>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-800">Location name</label>
                    <input
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      placeholder="Location name"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-800">Notes (optional)</label>
                    <input
                      value={newLocationNotes}
                      onChange={(e) => setNewLocationNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Address</label>
                  <input
                    value={newLocationAddress1}
                    onChange={(e) => setNewLocationAddress1(e.target.value)}
                    placeholder="Address line 1"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  />
                  <input
                    value={newLocationAddress2}
                    onChange={(e) => setNewLocationAddress2(e.target.value)}
                    placeholder="Address line 2"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  />
                  <div className="grid gap-3 lg:grid-cols-2">
                    <input
                      value={newLocationCity}
                      onChange={(e) => setNewLocationCity(e.target.value)}
                      placeholder="City"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    <input
                      value={newLocationProvince}
                      onChange={(e) => setNewLocationProvince(e.target.value)}
                      placeholder="Province/State"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <input
                      value={newLocationPostal}
                      onChange={(e) => setNewLocationPostal(e.target.value)}
                      placeholder="Postal/Zip"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    <input
                      value={newLocationCountry}
                      onChange={(e) => setNewLocationCountry(e.target.value)}
                      placeholder="Country"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Contact</label>
                  <input
                    value={newLocationContactName}
                    onChange={(e) => setNewLocationContactName(e.target.value)}
                    placeholder="Contact name"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  />
                  <div className="grid gap-3 lg:grid-cols-2">
                    <input
                      value={newLocationContactPhone}
                      onChange={(e) => setNewLocationContactPhone(e.target.value)}
                      placeholder="Contact phone"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    <input
                      value={newLocationContactEmail}
                      onChange={(e) => setNewLocationContactEmail(e.target.value)}
                      placeholder="Contact email"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Commission %</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newLocationCommissionRate}
                    onChange={(e) => setNewLocationCommissionRate(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="e.g. 20"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAddLocation}
                    disabled={addingLocation}
                    className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                  >
                    {addingLocation ? "Saving..." : "Save location"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Select location</label>
                  <select
                    value={editLocationId || ""}
                    onChange={(e) => setEditLocationId(e.target.value || null)}
                    className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  >
                    <option value="">Select a location</option>
                    {locationOptions.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-800">Location name</label>
                    <input
                      value={editLocationName}
                      onChange={(e) => setEditLocationName(e.target.value)}
                      placeholder="Location name"
                      disabled={editLocationName.trim().toLowerCase() === "online shop"}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-800">Notes (optional)</label>
                    <input
                      value={editLocationNotes}
                      onChange={(e) => setEditLocationNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Address</label>
                  <input
                    value={editLocationAddress1}
                    onChange={(e) => setEditLocationAddress1(e.target.value)}
                    placeholder="Address line 1"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  />
                  <input
                    value={editLocationAddress2}
                    onChange={(e) => setEditLocationAddress2(e.target.value)}
                    placeholder="Address line 2"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  />
                  <div className="grid gap-3 lg:grid-cols-2">
                    <input
                      value={editLocationCity}
                      onChange={(e) => setEditLocationCity(e.target.value)}
                      placeholder="City"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    <input
                      value={editLocationProvince}
                      onChange={(e) => setEditLocationProvince(e.target.value)}
                      placeholder="Province/State"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <input
                      value={editLocationPostal}
                      onChange={(e) => setEditLocationPostal(e.target.value)}
                      placeholder="Postal/Zip"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    <input
                      value={editLocationCountry}
                      onChange={(e) => setEditLocationCountry(e.target.value)}
                      placeholder="Country"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Contact</label>
                  <input
                    value={editLocationContactName}
                    onChange={(e) => setEditLocationContactName(e.target.value)}
                    placeholder="Contact name"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  />
                  <div className="grid gap-3 lg:grid-cols-2">
                    <input
                      value={editLocationContactPhone}
                      onChange={(e) => setEditLocationContactPhone(e.target.value)}
                      placeholder="Contact phone"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    <input
                      value={editLocationContactEmail}
                      onChange={(e) => setEditLocationContactEmail(e.target.value)}
                      placeholder="Contact email"
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Commission %</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editLocationCommissionRate}
                    onChange={(e) => setEditLocationCommissionRate(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="e.g. 20"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleUpdateLocation}
                    disabled={updatingLocation || !editLocationId}
                    className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                  >
                    {updatingLocation ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteLocation}
                    disabled={
                      deletingLocation ||
                      !editLocationId ||
                      editLocationName.trim().toLowerCase() === "online shop"
                    }
                    className="rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingLocation ? "Removing..." : "Delete location"}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
      {items.length === 0 && (
        <p className="text-sm text-neutral-600">No paintings yet.</p>
      )}
      {items.map((painting) => {
        const isExpanded = expandedPaintingId === painting.id;
        const isSold = (painting.status || "").trim().toLowerCase() === "sold";
        return (
        <div
          key={painting.id}
          ref={(el) => {
            itemRefs.current.set(painting.id, el);
          }}
          data-painting-id={painting.id}
          onPointerDown={(event) => {
            if (
              event.button !== 0 ||
              !isGalleryRoute ||
              reordering ||
              isInteractiveTarget(event.target)
            )
              return;
            if (event.currentTarget instanceof HTMLElement) {
              event.currentTarget.setPointerCapture(event.pointerId);
            }
            initialOrder.current = items.map((item) => item.id);
            setDraggingId(painting.id);
            setDragOverId(painting.id);
            lastDragTargetRef.current = painting.id;
            document.body.style.cursor = "grabbing";
            document.body.style.userSelect = "none";
          }}
          className={`space-y-6 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6 transition-shadow ${
            dragOverId === painting.id ? "ring-2 ring-sky-300" : ""
          } ${draggingId === painting.id ? "shadow-lg opacity-90" : ""} ${
            isGalleryRoute ? "cursor-grab active:cursor-grabbing" : ""
          }`}
        >
          {isGalleryRoute ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
              <span className="font-medium text-neutral-600">
                Drag anywhere on the card to reorder
              </span>
              {reordering ? <span>Saving order...</span> : null}
            </div>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() =>
                  setExpandedPaintingId((prev) => (prev === painting.id ? null : painting.id))
                }
                aria-expanded={isExpanded}
                className="group relative overflow-hidden rounded border border-neutral-200 bg-neutral-50 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={painting.image_url}
                  alt={painting.title}
                  className="h-56 w-full object-cover sm:h-72 lg:h-[360px]"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 py-2 text-sm font-semibold text-white sm:hidden">
                  <span className="truncate">{painting.title || "Untitled painting"}</span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {isExpanded ? "Hide" : "Edit"}
                  </span>
                </div>
              </button>
              <label
                className={`flex items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm ${
                  isExpanded ? "flex" : "hidden"
                } sm:flex`}
              >
                <input
                  type="radio"
                  name="home-image"
                  checked={homeId === painting.id}
                  onChange={() => handleSelectHome(painting.id)}
                />
                Set as homepage image
              </label>
              <label
                className={`flex items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm ${
                  isExpanded ? "flex" : "hidden"
                } sm:flex`}
              >
                <input
                  type="checkbox"
                  checked={painting.include_in_gallery ?? true}
                  onChange={(e) =>
                    handleFieldChange(
                      painting.id,
                      "include_in_gallery",
                      e.target.checked
                    )
                  }
                />
                Include in gallery?
              </label>
            </div>

            <div className={`${isExpanded ? "block" : "hidden"} space-y-4 sm:block`}>
              <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-sm font-semibold text-neutral-900">Original</div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
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
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-800">
                      Price
                    </label>
                    <input
                      value={painting.price_original}
                      onChange={(e) =>
                        handleFieldChange(painting.id, "price_original", e.target.value)
                      }
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-800">
                    Details
                  </label>
                    <textarea
                      value={painting.details || ""}
                      onChange={(e) =>
                        handleFieldChange(painting.id, "details", e.target.value)
                      }
                      rows={6}
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-800">
                        Size (original)
                      </label>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <input
                          value={stripInches(painting.size_original.split("x")[0]?.trim() || "")}
                          onChange={(e) => {
                            const parts = painting.size_original
                              .split("x")
                              .map((p) => stripInches(p.trim()));
                            const height = parts[1] ?? "";
                            handleFieldChange(
                              painting.id,
                              "size_original",
                              `${stripInches(e.target.value)} x ${height}`
                            );
                          }}
                          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          placeholder="Width"
                          aria-label="Original width"
                        />
                        <span className="text-sm text-neutral-700">x</span>
                        <input
                          value={stripInches(painting.size_original.split("x")[1]?.trim() || "")}
                          onChange={(e) => {
                            const parts = painting.size_original
                              .split("x")
                              .map((p) => stripInches(p.trim()));
                            const width = parts[0] ?? "";
                            handleFieldChange(
                              painting.id,
                              "size_original",
                              `${width} x ${stripInches(e.target.value)}`
                            );
                          }}
                          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          placeholder="Height"
                          aria-label="Original height"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
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
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-neutral-800">
                        Status
                      </label>
                      <select
                        value={painting.status || ""}
                        onChange={(e) =>
                          handleStatusChange(painting.id, e.target.value)
                        }
                        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value="available for sale">Available for sale</option>
                        <option value="sold">Sold</option>
                        <option value="not available for sale">Not available for sale</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`${isExpanded ? "block" : "hidden"} space-y-3 sm:block`}>
            {isSold ? (
              <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-sm font-semibold text-neutral-900">
                  Sold to {painting.sold_customer_name || "Unknown buyer"} for{" "}
                  {formatMoney(painting.sold_price)}
                </div>
              </div>
            ) : (
              <div
                className={`space-y-3 rounded border p-4 ${
                  isDateBeforeToday(painting.location_end_date)
                    ? "border-amber-200 bg-amber-50"
                    : "border-neutral-200 bg-neutral-50"
                }`}
              >
                <div className="text-sm font-semibold text-neutral-900">Location</div>
                {isDateBeforeToday(painting.location_end_date) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-amber-100 px-3 py-2 text-xs text-amber-900">
                    <span>
                      Location end date has passed. Mark this painting as retrieved.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMarkRetrieved(painting.id)}
                      disabled={retrievingId === painting.id}
                      className="rounded border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-50 disabled:opacity-60"
                    >
                      {retrievingId === painting.id ? "Updating..." : "Retrieved"}
                    </button>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-neutral-800">
                    Location
                  </label>
                  {(() => {
                    const alreadyHas = painting.location_id
                      ? locationOptions.some((loc) => idToString(loc.id) === idToString(painting.location_id))
                      : false;
                    const filteredLocations = locationOptions.filter(
                      (loc) => loc.name.trim().toLowerCase() !== "online shop"
                    );
                    const options =
                      alreadyHas || !painting.location_id
                        ? filteredLocations
                        : [
                            {
                              id: painting.location_id,
                              name: painting.location_name || "Unknown location",
                              notes: null,
                            },
                            ...filteredLocations,
                          ];
                    return (
                    <select
                      value={idToString(painting.location_id)}
                      onChange={(e) =>
                        handleLocationChange(
                          painting.id,
                          e.target.value ? e.target.value : null
                        )
                      }
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    >
                      <option value="">No location</option>
                      {options.map((loc) => (
                      <option key={idToString(loc.id)} value={idToString(loc.id)}>
                        {loc.name}
                      </option>
                    ))}
                    </select>
                    );
                  })()}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-neutral-800">
                      Location start date
                    </label>
                      <input
                        type="date"
                        value={normalizeDateInput(painting.location_start_date)}
                      onChange={(e) =>
                        handleFieldChange(
                          painting.id,
                          "location_start_date",
                          e.target.value
                        )
                      }
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-neutral-800">
                      Location end date
                    </label>
                      <input
                        type="date"
                        value={normalizeDateInput(painting.location_end_date)}
                      onChange={(e) =>
                        handleFieldChange(
                          painting.id,
                          "location_end_date",
                          e.target.value
                        )
                      }
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-neutral-800">
                    Commission %
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={painting.location_commission_rate || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        painting.id,
                        "location_commission_rate",
                        e.target.value
                      )
                    }
                    placeholder="e.g. 30"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  />
                </div>
              </div>
            )}
          </div>

          <div className={`${isExpanded ? "flex" : "hidden"} flex-wrap items-center gap-3 sm:flex`}>
            <button
              type="button"
              onClick={() => handleSave(painting)}
              disabled={savingId === painting.id}
              className="w-full rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60 sm:w-auto"
            >
              {savingId === painting.id ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(painting.id)}
              disabled={deletingId === painting.id}
              className="w-full rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 sm:w-auto"
            >
              {deletingId === painting.id ? "Deleting..." : "Delete painting"}
            </button>
            {message && <span className="text-sm text-neutral-700">{message}</span>}
          </div>
        </div>
        );
      })}
      {isGalleryRoute && activeInventoryPrintId &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              ref={modalRef}
              className="w-full max-w-sm space-y-4 rounded-lg bg-white p-5 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">Edit inventory</h3>
                <button
                  type="button"
                  onClick={() => {
                    setActiveInventoryPrintId(null);
                    setInventoryQty("");
                  }}
                  className="text-sm text-neutral-600 hover:text-neutral-900"
                >
                  ×
                </button>
              </div>
              <div className="space-y-2 text-sm text-neutral-800">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-800">Location</label>
                  <select
                    value={inventoryLocationId || ""}
                    onChange={(e) =>
                      setInventoryLocationId(e.target.value ? e.target.value : null)
                    }
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                  >
                    {locationOptions.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-neutral-800">Mode</label>
                  <select
                    value={inventoryMode}
                    onChange={(e) =>
                      setInventoryMode(e.target.value === "remove" ? "remove" : "add")
                    }
                    className="rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                  >
                    <option value="add">Add</option>
                    <option value="remove">Remove</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-neutral-800">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={inventoryQty}
                    onChange={(e) => setInventoryQty(e.target.value)}
                    className="w-28 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-800">Reason</label>
                  <select
                    value={inventoryReason}
                    onChange={(e) => setInventoryReason(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                  >
                    <option value="manual_add">Manual add</option>
                    <option value="damaged">Damaged/Lost</option>
                    <option value="sold">Sold (offline)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveInventoryPrintId(null);
                    setInventoryQty("");
                  }}
                  className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInventoryAdjust}
                  disabled={updatingQtyId === activeInventoryPrintId}
                  className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                >
                  {updatingQtyId === activeInventoryPrintId ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {isGalleryRoute && activeSoldPaintingId &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              ref={soldModalRef}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 rounded-lg bg-white p-5 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">Mark as sold</h3>
                <button
                  type="button"
                  onClick={() => {
                    if (previousStatus !== null) {
                      handleFieldChange(activeSoldPaintingId, "status", previousStatus);
                    }
                    setActiveSoldPaintingId(null);
                    setPreviousStatus(null);
                  }}
                  className="text-sm text-neutral-600 hover:text-neutral-900"
                >
                  ×
                </button>
              </div>
              <div className="space-y-3 text-sm text-neutral-800">
                <p className="text-xs text-neutral-600">
                  Enter order details (for record-keeping; this modal does not update orders).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700">First name</label>
                    <input
                      value={soldDetails[activeSoldPaintingId]?.customerFirstName || ""}
                      onChange={(e) =>
                        setSoldDetails((prev) => ({
                          ...prev,
                          [activeSoldPaintingId]: {
                            ...prev[activeSoldPaintingId],
                            customerFirstName: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700">Last name</label>
                    <input
                      value={soldDetails[activeSoldPaintingId]?.customerLastName || ""}
                      onChange={(e) =>
                        setSoldDetails((prev) => ({
                          ...prev,
                          [activeSoldPaintingId]: {
                            ...prev[activeSoldPaintingId],
                            customerLastName: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700">Email</label>
                  <input
                    value={soldDetails[activeSoldPaintingId]?.customerEmail || ""}
                    onChange={(e) =>
                      setSoldDetails((prev) => ({
                        ...prev,
                        [activeSoldPaintingId]: {
                          ...prev[activeSoldPaintingId],
                          customerEmail: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700">Phone</label>
                  <input
                    value={soldDetails[activeSoldPaintingId]?.customerPhone || ""}
                    onChange={(e) =>
                      setSoldDetails((prev) => ({
                        ...prev,
                        [activeSoldPaintingId]: {
                          ...prev[activeSoldPaintingId],
                          customerPhone: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                  />
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700">Address line 1</label>
                    <input
                      value={soldDetails[activeSoldPaintingId]?.shipAddress1 || ""}
                      onChange={(e) =>
                        setSoldDetails((prev) => ({
                          ...prev,
                          [activeSoldPaintingId]: {
                            ...prev[activeSoldPaintingId],
                            shipAddress1: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700">Address line 2</label>
                    <input
                      value={soldDetails[activeSoldPaintingId]?.shipAddress2 || ""}
                      onChange={(e) =>
                        setSoldDetails((prev) => ({
                          ...prev,
                          [activeSoldPaintingId]: {
                            ...prev[activeSoldPaintingId],
                            shipAddress2: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-700">City</label>
                      <input
                        value={soldDetails[activeSoldPaintingId]?.shipCity || ""}
                        onChange={(e) =>
                          setSoldDetails((prev) => ({
                            ...prev,
                            [activeSoldPaintingId]: {
                              ...prev[activeSoldPaintingId],
                              shipCity: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-700">Province/State</label>
                      <input
                        value={soldDetails[activeSoldPaintingId]?.shipProvince || ""}
                        onChange={(e) =>
                          setSoldDetails((prev) => ({
                            ...prev,
                            [activeSoldPaintingId]: {
                              ...prev[activeSoldPaintingId],
                              shipProvince: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-700">Postal/Zip</label>
                      <input
                        value={soldDetails[activeSoldPaintingId]?.shipPostal || ""}
                        onChange={(e) =>
                          setSoldDetails((prev) => ({
                            ...prev,
                            [activeSoldPaintingId]: {
                              ...prev[activeSoldPaintingId],
                              shipPostal: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-700">Country</label>
                      <input
                        value={soldDetails[activeSoldPaintingId]?.shipCountry || ""}
                        onChange={(e) =>
                          setSoldDetails((prev) => ({
                            ...prev,
                            [activeSoldPaintingId]: {
                              ...prev[activeSoldPaintingId],
                              shipCountry: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700">Price paid</label>
                    <input
                      ref={priceInputRef}
                      type="number"
                      min={0.01}
                      step="0.01"
                      required
                      value={soldDetails[activeSoldPaintingId]?.pricePaid || ""}
                      onChange={(e) =>
                        setSoldDetails((prev) => ({
                          ...prev,
                          [activeSoldPaintingId]: {
                            ...prev[activeSoldPaintingId],
                            pricePaid: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                    />
                  </div>
                </div>
                {activeSoldPainting?.location_id || activeSoldPainting?.location_name ? (
                  <div className="space-y-2 rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
                    <div className="font-semibold text-neutral-900">Location</div>
                    <div className="flex items-center justify-between">
                      <span>Name</span>
                      <span className="font-semibold text-neutral-900">
                        {activeSoldPainting.location_name || "Unknown location"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-700">Commission %</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={activeSoldPainting.location_commission_rate || ""}
                        onChange={(e) =>
                          handleFieldChange(
                            activeSoldPainting.id,
                            "location_commission_rate",
                            e.target.value
                          )
                        }
                        placeholder="e.g. 30"
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (previousStatus !== null) {
                      handleFieldChange(activeSoldPaintingId, "status", previousStatus);
                    }
                    setActiveSoldPaintingId(null);
                    setPreviousStatus(null);
                  }}
                  className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const details = soldDetails[activeSoldPaintingId] || {};
                    if (priceInputRef.current && !priceInputRef.current.reportValidity()) {
                      return;
                    }
                    setSavingSold(true);
                    setMessage(null);
                    markPaintingSoldAction({
                      paintingId: activeSoldPaintingId!,
                      pricePaid: Number(details.pricePaid),
                      commissionRate: activeSoldPainting?.location_commission_rate || null,
                      customerFirstName: details.customerFirstName || null,
                      customerLastName: details.customerLastName || null,
                      customerEmail: details.customerEmail || null,
                      customerPhone: details.customerPhone || null,
                      shipAddress1: details.shipAddress1 || null,
                      shipAddress2: details.shipAddress2 || null,
                      shipCity: details.shipCity || null,
                      shipProvince: details.shipProvince || null,
                      shipPostal: details.shipPostal || null,
                      shipCountry: details.shipCountry || null,
                    })
                      .then(() => {
                        handleFieldChange(activeSoldPaintingId!, "status", "sold");
                        setActiveSoldPaintingId(null);
                        setPreviousStatus(null);
                        setMessage("Sale recorded.");
                        setTimeout(() => setMessage(null), 2000);
                        router.refresh();
                      })
                      .catch((err) => setMessage((err as Error).message))
                      .finally(() => setSavingSold(false));
                  }}
                  disabled={savingSold}
                  className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                >
                  {savingSold ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
  );
}
