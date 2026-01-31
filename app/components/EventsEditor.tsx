"use client";

import { useMemo, useState } from "react";
import {
  createEventAction,
  deleteEventAction,
  getEventsAction,
  updateEventAction,
} from "@/app/actions/events";

type EventRecord = {
  id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  name: string;
  location: string | null;
  street_number: string | null;
  street_name: string | null;
  postal_code: string | null;
  province: string | null;
  city: string | null;
  details: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  initialEvents: EventRecord[];
  galleryImages: { id: string; title: string | null; image_url: string }[];
};

function toTodayString() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function formatAddress(event: EventRecord) {
  const parts = [
    [event.street_number, event.street_name].filter(Boolean).join(" "),
    event.city,
    event.postal_code,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function EventsEditor({ initialEvents, galleryImages }: Props) {
  const [events, setEvents] = useState<EventRecord[]>(initialEvents);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [eventFiles, setEventFiles] = useState<Record<string, File | null>>({});
  const [eventFilePreviews, setEventFilePreviews] = useState<Record<string, string>>(
    {}
  );
  const [newEventFile, setNewEventFile] = useState<File | null>(null);
  const [newEventPreview, setNewEventPreview] = useState<string | null>(null);
  const today = toTodayString();

  const [newEvent, setNewEvent] = useState(() => ({
    event_date: today,
    start_time: "",
    end_time: "",
    name: "",
    location: "",
    street_number: "",
    street_name: "",
    postal_code: "",
    province: "",
    city: "",
    details: "",
    image_url: "",
  }));

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const upcoming: EventRecord[] = [];
    const past: EventRecord[] = [];
    for (const event of events) {
      if (event.event_date >= today) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    }
    upcoming.sort((a, b) => {
      if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
      return (a.start_time || "").localeCompare(b.start_time || "");
    });
    past.sort((a, b) => {
      if (a.event_date !== b.event_date) return b.event_date.localeCompare(a.event_date);
      return (b.start_time || "").localeCompare(a.start_time || "");
    });
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [events, today]);

  const refreshEvents = async () => {
    const next = await getEventsAction();
    setEvents(next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSavingId("new");
    try {
      const formData = new FormData();
      formData.set("event_date", newEvent.event_date);
      formData.set("start_time", newEvent.start_time || "");
      formData.set("end_time", newEvent.end_time || "");
      formData.set("name", newEvent.name);
      formData.set("location", newEvent.location || "");
      formData.set("street_number", newEvent.street_number || "");
      formData.set("street_name", newEvent.street_name || "");
      formData.set("postal_code", newEvent.postal_code || "");
      formData.set("province", newEvent.province || "");
      formData.set("city", newEvent.city || "");
      formData.set("details", newEvent.details || "");
      formData.set("image_url", newEvent.image_url || "");
      if (newEventFile) {
        formData.set("image_file", newEventFile);
      }
      await createEventAction(formData);
      await refreshEvents();
      setNewEvent({
        event_date: today,
        start_time: "",
        end_time: "",
        name: "",
        location: "",
        street_number: "",
        street_name: "",
        postal_code: "",
        province: "",
        city: "",
        details: "",
        image_url: "",
      });
      if (newEventPreview) {
        URL.revokeObjectURL(newEventPreview);
      }
      setNewEventPreview(null);
      setNewEventFile(null);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdate = async (event: EventRecord) => {
    setMessage(null);
    setSavingId(event.id);
    try {
      const formData = new FormData();
      formData.set("id", event.id);
      formData.set("event_date", event.event_date);
      formData.set("start_time", event.start_time || "");
      formData.set("end_time", event.end_time || "");
      formData.set("name", event.name);
      formData.set("location", event.location || "");
      formData.set("street_number", event.street_number || "");
      formData.set("street_name", event.street_name || "");
      formData.set("postal_code", event.postal_code || "");
      formData.set("province", event.province || "");
      formData.set("city", event.city || "");
      formData.set("details", event.details || "");
      formData.set("image_url", event.image_url || "");
      const file = eventFiles[event.id];
      if (file) {
        formData.set("image_file", file);
      }
      await updateEventAction(formData);
      await refreshEvents();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    setMessage(null);
    setDeletingId(id);
    try {
      await deleteEventAction(id);
      await refreshEvents();
      const preview = eventFilePreviews[id];
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const updateEventField = (
    id: string,
    field: keyof EventRecord,
    value: string | null
  ) => {
    setEvents((prev) =>
      prev.map((event) => (event.id === id ? { ...event, [field]: value } : event))
    );
  };

  const handleNewEventFile = (file: File | null) => {
    if (newEventPreview) {
      URL.revokeObjectURL(newEventPreview);
    }
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setNewEventPreview(previewUrl);
      setNewEventFile(file);
      setNewEvent((prev) => ({ ...prev, image_url: "" }));
    } else {
      setNewEventPreview(null);
      setNewEventFile(null);
    }
  };

  const handleEventFile = (id: string, file: File | null) => {
    const existingPreview = eventFilePreviews[id];
    if (existingPreview) {
      URL.revokeObjectURL(existingPreview);
    }
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setEventFilePreviews((prev) => ({ ...prev, [id]: previewUrl }));
      setEventFiles((prev) => ({ ...prev, [id]: file }));
    } else {
      setEventFilePreviews((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEventFiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleCreate}
        className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">Add event</h2>
          {savingId === "new" ? (
            <span className="text-sm font-medium text-neutral-500">Saving...</span>
          ) : null}
        </div>
        {message ? (
          <p className="mt-2 text-sm text-red-600">{message}</p>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Date</label>
            <input
              type="date"
              required
              value={newEvent.event_date}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, event_date: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-800">Start time</label>
              <input
                type="time"
                value={newEvent.start_time}
                onChange={(e) =>
                  setNewEvent((prev) => ({ ...prev, start_time: e.target.value }))
                }
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-800">End time</label>
              <input
                type="time"
                value={newEvent.end_time}
                onChange={(e) =>
                  setNewEvent((prev) => ({ ...prev, end_time: e.target.value }))
                }
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-neutral-800">Event name</label>
            <input
              required
              value={newEvent.name}
              onChange={(e) => setNewEvent((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-neutral-800">Location</label>
            <input
              value={newEvent.location}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, location: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-neutral-800">
              Event image
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <select
                  value={newEvent.image_url}
                  onChange={(e) => {
                    handleNewEventFile(null);
                    setNewEvent((prev) => ({
                      ...prev,
                      image_url: e.target.value,
                    }));
                  }}
                  className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  <option value="">Select from gallery (optional)</option>
                  {galleryImages.map((img) => (
                    <option key={img.id} value={img.image_url}>
                      {img.title ? img.title : "Untitled"}
                    </option>
                  ))}
                </select>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleNewEventFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-neutral-700"
                />
              </div>
              <div className="flex items-center justify-start">
                {newEventPreview || newEvent.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={newEventPreview || newEvent.image_url}
                    alt="Event preview"
                    className="h-32 w-48 rounded-md object-cover"
                  />
                ) : (
                  <span className="text-xs text-neutral-500">
                    No image selected.
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Street number</label>
            <input
              value={newEvent.street_number}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, street_number: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Street name</label>
            <input
              value={newEvent.street_name}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, street_name: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Postal code</label>
            <input
              value={newEvent.postal_code}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, postal_code: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">City</label>
            <input
              value={newEvent.city}
              onChange={(e) => setNewEvent((prev) => ({ ...prev, city: e.target.value }))}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Province/State</label>
            <input
              value={newEvent.province}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, province: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-neutral-800">Details</label>
            <textarea
              rows={3}
              value={newEvent.details}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, details: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={savingId === "new"}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
          >
            {savingId === "new" ? "Saving..." : "Save event"}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Upcoming events</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-neutral-600">No upcoming events.</p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((event) => {
              const isExpanded = expandedId === event.id;
              return (
                <div
                  key={event.id}
                  className="rounded-lg border border-neutral-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">
                        {event.name}
                      </div>
                      <div className="text-xs text-neutral-600">
                        {event.event_date}
                        {event.start_time ? ` · ${event.start_time}` : ""}
                        {event.end_time ? `–${event.end_time}` : ""}
                      </div>
                      {event.location || formatAddress(event) ? (
                        <div className="text-xs text-neutral-500">
                          {[event.location, formatAddress(event)].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-xs font-semibold text-neutral-500">
                      {isExpanded ? "Hide" : "Edit"}
                    </span>
                  </button>
                  {isExpanded ? (
                    <div className="border-t border-neutral-200 px-4 py-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-neutral-800">Date</label>
                          <input
                            type="date"
                            value={event.event_date}
                            onChange={(e) =>
                              updateEventField(event.id, "event_date", e.target.value)
                            }
                            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-neutral-800">Start</label>
                            <input
                              type="time"
                              value={event.start_time || ""}
                              onChange={(e) =>
                                updateEventField(
                                  event.id,
                                  "start_time",
                                  e.target.value || null
                                )
                              }
                              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-neutral-800">End</label>
                            <input
                              type="time"
                              value={event.end_time || ""}
                              onChange={(e) =>
                                updateEventField(
                                  event.id,
                                  "end_time",
                                  e.target.value || null
                                )
                              }
                              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                            />
                          </div>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-sm font-medium text-neutral-800">Event name</label>
                          <input
                            value={event.name}
                            onChange={(e) =>
                              updateEventField(event.id, "name", e.target.value)
                            }
                            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-sm font-medium text-neutral-800">Location</label>
                          <input
                            value={event.location || ""}
                            onChange={(e) =>
                              updateEventField(event.id, "location", e.target.value)
                            }
                            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-sm font-medium text-neutral-800">
                            Event image
                          </label>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <select
                                value={event.image_url || ""}
                                onChange={(e) => {
                                  handleEventFile(event.id, null);
                                  updateEventField(event.id, "image_url", e.target.value);
                                }}
                                className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                              >
                                <option value="">Select from gallery (optional)</option>
                                {galleryImages.map((img) => (
                                  <option key={img.id} value={img.image_url}>
                                    {img.title ? img.title : "Untitled"}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleEventFile(event.id, e.target.files?.[0] ?? null)
                                }
                                className="block w-full text-sm text-neutral-700"
                              />
                            </div>
                            <div className="flex items-center justify-start">
                              {eventFilePreviews[event.id] || event.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={eventFilePreviews[event.id] || event.image_url || ""}
                                  alt="Event preview"
                                  className="h-32 w-48 rounded-md object-cover"
                                />
                              ) : (
                                <span className="text-xs text-neutral-500">
                                  No image selected.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-neutral-800">Street number</label>
                          <input
                            value={event.street_number || ""}
                            onChange={(e) =>
                              updateEventField(event.id, "street_number", e.target.value)
                            }
                            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-neutral-800">Street name</label>
                          <input
                            value={event.street_name || ""}
                            onChange={(e) =>
                              updateEventField(event.id, "street_name", e.target.value)
                            }
                            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-neutral-800">Postal code</label>
                          <input
                            value={event.postal_code || ""}
                            onChange={(e) =>
                              updateEventField(event.id, "postal_code", e.target.value)
                            }
                            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-neutral-800">City</label>
                          <input
                            value={event.city || ""}
                            onChange={(e) =>
                              updateEventField(event.id, "city", e.target.value)
                            }
                            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-neutral-800">
                            Province/State
                          </label>
                          <input
                            value={event.province || ""}
                            onChange={(e) =>
                              updateEventField(event.id, "province", e.target.value)
                            }
                            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-sm font-medium text-neutral-800">Details</label>
                          <textarea
                            rows={3}
                            value={event.details || ""}
                            onChange={(e) =>
                              updateEventField(event.id, "details", e.target.value)
                            }
                            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleUpdate(event)}
                          disabled={savingId === event.id}
                          className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                        >
                          {savingId === event.id ? "Saving..." : "Save changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(event.id)}
                          disabled={deletingId === event.id}
                          className="rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingId === event.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Past events</h2>
        {pastEvents.length === 0 ? (
          <p className="text-sm text-neutral-600">No past events.</p>
        ) : (
          <div className="space-y-3">
            {pastEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <div className="text-sm font-semibold text-neutral-900">{event.name}</div>
                  <div className="text-xs text-neutral-600">
                    {event.event_date}
                    {event.start_time ? ` · ${event.start_time}` : ""}
                    {event.end_time ? `–${event.end_time}` : ""}
                  </div>
                  {event.location || formatAddress(event) ? (
                    <div className="text-xs text-neutral-500">
                      {[event.location, formatAddress(event)].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(event.id)}
                  disabled={deletingId === event.id}
                  className="rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingId === event.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
