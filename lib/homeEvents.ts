import type { EventType } from "@/lib/eventSchedule";

type DatedEvent = { event_date: string; end_date: string | null; event_type: EventType };

export function groupHomeEvents<T extends DatedEvent>(events: T[], today: string) {
  const current: T[] = [];
  const upcoming: T[] = [];
  const singleDay: T[] = [];
  for (const event of events) {
    if ((event.end_date || event.event_date) < today) continue;
    if (event.event_type === "single_day") singleDay.push(event);
    else if (event.event_date <= today) current.push(event);
    else upcoming.push(event);
  }
  return [
    { title: current.length === 1 ? "Current exhibition" : "Current exhibitions", events: current },
    { title: singleDay.length === 1 ? "Upcoming event" : "Upcoming events", events: singleDay },
    { title: upcoming.length === 1 ? "Upcoming exhibition" : "Upcoming exhibitions", events: upcoming },
  ].filter((group) => group.events.length > 0);
}
