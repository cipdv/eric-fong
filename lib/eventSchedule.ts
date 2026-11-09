export type EventType = "exhibition" | "group_exhibition" | "single_day";

export type SubEvent = {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  details: string;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseEventSchedule(formData: FormData): {
  date: string;
  endDate: string | null;
  eventType: EventType;
  subEvents: SubEvent[];
  addToCv: boolean;
} {
  const date = String(formData.get("event_date") ?? "").trim();
  if (!validDate(date)) throw new Error("A valid start date is required.");
  const eventType = formData.get("event_type");
  if (eventType !== "exhibition" && eventType !== "group_exhibition" && eventType !== "single_day") {
    throw new Error("Select an event type: Solo exhibition, Group exhibition, or Single-day event.");
  }
  const singleDay = eventType === "single_day";
  const endDate = singleDay ? null : String(formData.get("end_date") ?? "").trim();
  if (!singleDay && (!endDate || !validDate(endDate))) {
    throw new Error("A valid end date is required for an exhibition.");
  }
  if (endDate && endDate < date) throw new Error("End date cannot be before start date.");
  let raw: unknown;
  try { raw = JSON.parse(String(formData.get("sub_events") ?? "[]")); }
  catch { throw new Error("Invalid sub-events."); }
  if (!Array.isArray(raw)) throw new Error("Invalid sub-events.");
  const subEvents: SubEvent[] = raw.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid sub-event.");
    const text = (key: string) => typeof item[key] === "string" ? item[key].trim() : "";
    const sub = {
      id: text("id"), title: text("title"), event_date: text("event_date"),
      start_time: text("start_time"), end_time: text("end_time"),
      location: text("location"), details: text("details"),
    };
    if (!sub.title || !validDate(sub.event_date)) {
      throw new Error("Each sub-event requires a title and a valid date.");
    }
    for (const time of [sub.start_time, sub.end_time]) {
      if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Invalid sub-event time.");
    }
    if (sub.start_time && sub.end_time && sub.end_time < sub.start_time) {
      throw new Error("Sub-event end time cannot be before its start time.");
    }
    return sub;
  });
  const addToCv = !singleDay && formData.get("add_to_cv") === "true";
  return { date, endDate, eventType, subEvents, addToCv };
}
