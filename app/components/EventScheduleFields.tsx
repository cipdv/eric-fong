"use client";

import type { EventType, SubEvent } from "@/lib/eventSchedule";
import type { ReactNode } from "react";

type Props = {
  startDate: string;
  subEvents: SubEvent[];
  onSubEventsChange: (value: SubEvent[]) => void;
};

const inputClass = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";

export function EventDateFields({ eventType, startDate, endDate, addToCv, onAddToCvChange, onEventTypeChange, onStartDateChange, onEndDateChange, children }: {
  children?: ReactNode;
  eventType: EventType;
  addToCv: boolean;
  onAddToCvChange: (value: boolean) => void;
  onEventTypeChange: (value: EventType) => void;
  startDate: string;
  endDate: string | null;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string | null) => void;
}) {
  return (
    <div className="space-y-3 md:col-span-2">
      <label className="block space-y-1 text-sm font-medium">
        <span>Event type</span>
        <select value={eventType} onChange={(e) => onEventTypeChange(e.target.value as EventType)} className={inputClass}>
          <option value="exhibition">Solo exhibition</option>
          <option value="group_exhibition">Group exhibition</option>
          <option value="single_day">Single-day event</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 space-y-1 text-sm font-medium">
          <span>{eventType !== "single_day" ? "Start date (required)" : "Date (required)"}</span>
          <input type="date" required value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)} className={inputClass} />
        </label>
        {eventType !== "single_day" && (
          <label className="min-w-0 space-y-1 text-sm font-medium">
            <span>End date (required)</span>
            <input type="date" required min={startDate} value={endDate ?? ""}
              onChange={(e) => onEndDateChange(e.target.value)} className={inputClass} />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {eventType !== "single_day" && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={addToCv} onChange={(e) => onAddToCvChange(e.target.checked)} />
            Add to CV?
          </label>
        )}
        {children}
      </div>
      {eventType !== "single_day" && (
          <p className="text-xs text-neutral-600">
            Adds or updates this exhibition in your CV when saved. Unchecking keeps any existing CV entry.
          </p>
      )}
    </div>
  );
}

export default function EventScheduleFields({ startDate, subEvents, onSubEventsChange }: Props) {
  const updateSub = (index: number, field: keyof SubEvent, value: string) => {
    onSubEventsChange(subEvents.map((sub, i) => i === index ? { ...sub, [field]: value } : sub));
  };
  return (
    <div className="space-y-4 md:col-span-2">
      <div className="space-y-3 rounded border border-neutral-200 p-4">
        <h3 className="text-sm font-semibold">Sub-events</h3>
        <p className="text-sm text-neutral-600">Add an artist talk or another activity. Only title and date are required.</p>
        {subEvents.map((sub, index) => (
          <div key={sub.id} className="grid gap-3 rounded border border-neutral-200 p-3 md:grid-cols-2">
            {([
              ["title", "Title (required)", "text"],
              ["event_date", "Date (required)", "date"],
              ["start_time", "Start time", "time"],
              ["end_time", "End time", "time"],
              ["location", "Location", "text"],
            ] as const).map(([field, label, type]) => (
              <label key={field} className="space-y-1 text-sm font-medium">
                <span>{label}</span>
                <input type={type} required={field === "title" || field === "event_date"}
                  value={sub[field]} onChange={(e) => updateSub(index, field, e.target.value)} className={inputClass} />
              </label>
            ))}
            <label className="space-y-1 text-sm font-medium md:col-span-2">
              <span>Details</span>
              <textarea rows={3} value={sub.details} onChange={(e) => updateSub(index, "details", e.target.value)} className={inputClass} />
            </label>
            <button type="button" className="justify-self-start text-sm text-red-700"
              onClick={() => onSubEventsChange(subEvents.filter((_, i) => i !== index))}>Remove sub-event</button>
          </div>
        ))}
        <button type="button" className="rounded border border-neutral-300 px-3 py-2 text-sm font-semibold"
          onClick={() => onSubEventsChange([...subEvents, {
            id: crypto.randomUUID(), title: "", event_date: startDate,
            start_time: "", end_time: "", location: "", details: "",
          }])}>Add sub-event</button>
      </div>
    </div>
  );
}
