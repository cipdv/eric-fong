import Image from "next/image";
import { sql } from "@vercel/postgres";
import type { EventType, SubEvent } from "@/lib/eventSchedule";
import { groupHomeEvents } from "@/lib/homeEvents";

export const dynamic = "force-dynamic";

type Painting = {
  id: string;
  image_url: string | null;
  title: string | null;
  is_home_image?: boolean;
  is_home_image_second?: boolean;
};

type EventRecord = {
  id: string;
  name: string;
  event_date: string;
  end_date: string | null;
  event_type: EventType;
  sub_events: SubEvent[];
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  street_number: string | null;
  street_name: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  details: string | null;
  image_url: string | null;
};

async function getHomePaintings(): Promise<Painting[]> {
  try {
    const { rows } = await sql<Painting>`
      SELECT id, image_url, title, is_home_image, is_home_image_second
      FROM paintings
      WHERE NULLIF(TRIM(image_url), '') IS NOT NULL
        AND (is_home_image = TRUE OR is_home_image_second = TRUE
          OR COALESCE(include_in_gallery, TRUE))
      ORDER BY is_home_image DESC NULLS LAST,
        is_home_image_second DESC NULLS LAST, created_at DESC, id
      LIMIT 3;
    `;
    const first = rows.find((row) => row.is_home_image)
      ?? rows.find((row) => !row.is_home_image_second)
      ?? rows[0];
    if (!first) return [];
    const second = rows.find((row) => row.id !== first.id && row.is_home_image_second)
      ?? rows.find((row) => row.id !== first.id);
    return second ? [first, second] : [first];
  } catch {
    // if column doesn't exist, fall through to fallback query
  }

  const fallback = await sql<Painting>`
    SELECT id, image_url, title
    FROM paintings
    WHERE NULLIF(TRIM(image_url), '') IS NOT NULL
      AND (is_home_image = TRUE OR COALESCE(include_in_gallery, TRUE))
    ORDER BY is_home_image DESC NULLS LAST, created_at DESC, id
    LIMIT 2;
  `;
  return fallback.rows;
}

async function getUpcomingEvents(): Promise<EventRecord[]> {
  try {
    const { rows } = await sql<EventRecord>`
      SELECT
        id,
        name,
        to_char(event_date, 'YYYY-MM-DD') AS event_date,
        to_jsonb(events)->>'end_date' AS end_date,
      COALESCE(to_jsonb(events)->>'event_type',
        CASE WHEN to_jsonb(events)->>'end_date' IS NULL THEN 'single_day' ELSE 'exhibition' END) AS event_type,
        COALESCE(to_jsonb(events)->'sub_events', '[]'::jsonb) AS sub_events,
        to_char(start_time, 'HH24:MI') AS start_time,
        to_char(end_time, 'HH24:MI') AS end_time,
        location,
        street_number,
        street_name,
        city,
        province,
        postal_code,
        details,
        image_url
      FROM events
      WHERE COALESCE((to_jsonb(events)->>'end_date')::date, event_date)
        >= (NOW() AT TIME ZONE 'America/Toronto')::date
      ORDER BY CASE WHEN event_date <= (NOW() AT TIME ZONE 'America/Toronto')::date THEN 0 ELSE 1 END,
        event_date ASC, start_time ASC NULLS LAST, created_at DESC, id;
    `;
    return rows.map((row) => ({
      ...row,
      event_date: String(row.event_date),
      name: String(row.name),
      start_time: row.start_time ? String(row.start_time) : null,
      end_time: row.end_time ? String(row.end_time) : null,
      location: row.location ? String(row.location) : null,
      street_number: row.street_number ? String(row.street_number) : null,
      street_name: row.street_name ? String(row.street_name) : null,
      city: row.city ? String(row.city) : null,
      province: row.province ? String(row.province) : null,
      postal_code: row.postal_code ? String(row.postal_code) : null,
      details: row.details ? String(row.details) : null,
      image_url: row.image_url ? String(row.image_url) : null,
    }));
  } catch {
    return [];
  }
}

async function getRandomPaintingImage(): Promise<string | null> {
  try {
    const { rows } = await sql<{ image_url: string | null }>`
      SELECT image_url
      FROM paintings
      WHERE image_url IS NOT NULL
      ORDER BY random()
      LIMIT 1;
    `;
    return rows[0]?.image_url ? String(rows[0].image_url) : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const paintingPromise = getHomePaintings();
  const eventsPromise = getUpcomingEvents();
  const fallbackImagePromise = getRandomPaintingImage();
  return (
    <div className="flex w-full justify-center sm:justify-start pb-12 px-4 sm:px-6">
      <HomeImage
        paintingPromise={paintingPromise}
        eventsPromise={eventsPromise}
        fallbackImagePromise={fallbackImagePromise}
      />
    </div>
  );
}

async function HomeImage({
  paintingPromise,
  eventsPromise,
  fallbackImagePromise,
}: {
  paintingPromise: Promise<Painting[]>;
  eventsPromise: Promise<EventRecord[]>;
  fallbackImagePromise: Promise<string | null>;
}) {
  const paintings = await paintingPromise;
  const events = await eventsPromise;
  const fallbackImage = await fallbackImagePromise;
  const homePaintings = paintings.length ? paintings : [{
    id: "fallback",
    image_url: "/1_1748550734_99480.webp",
    title: "Untitled",
  }];
  const formatDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  };

  const formatTime = (value: string) => {
    const [hourStr, minuteStr] = value.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
    const period = hour >= 12 ? "pm" : "am";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    if (minute === 0) {
      return `${hour12}${period}`;
    }
    return `${hour12}:${String(minute).padStart(2, "0")}${period}`;
  };

  const formatTimeRange = (start: string | null, end: string | null) => {
    if (!start && !end) return null;
    if (start && !end) return formatTime(start);
    if (!start && end) return formatTime(end);
    const startLabel = formatTime(start!);
    const endLabel = formatTime(end!);
    const startPeriod = startLabel.endsWith("am") ? "am" : "pm";
    const endPeriod = endLabel.endsWith("am") ? "am" : "pm";
    if (startPeriod === endPeriod) {
      const startNoPeriod = startLabel.replace(/(am|pm)$/, "");
      return `${startNoPeriod} - ${endLabel}`;
    }
    return `${startLabel} - ${endLabel}`;
  };

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const eventGroups = groupHomeEvents(events, today);
  return (
    <div className="flex w-full flex-col items-start gap-12">
      {eventGroups.map((group, groupIndex) => (
        <section key={group.title} className="w-full space-y-3 rounded-xl border border-neutral-200 bg-white p-5 sm:p-7" aria-labelledby={`event-group-${groupIndex}`}>
          <h1 id={`event-group-${groupIndex}`} className="text-lg font-medium tracking-wide text-neutral-600 sm:text-xl">
            {group.title}:
          </h1>
          <div className="space-y-10">
            {group.events.map((event, eventIndex) => {
              const address = [
                [event.street_number, event.street_name].filter(Boolean).join(" "),
                event.city, event.province, event.postal_code,
              ].filter(Boolean).join(", ");
              const timeLabel = formatTimeRange(event.start_time, event.end_time);
              return (
                <article key={event.id} className="space-y-6">
                  <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-4xl">{event.name}</h2>
                  <div className="grid items-start gap-6 lg:grid-cols-2">
                  <Image
                    src={event.image_url || fallbackImage || "/1_1748550734_99480.webp"}
                    alt={event.name}
                    width={1400} height={1400} sizes="(min-width: 1024px) 35vw, 90vw"
                    priority={groupIndex === 0 && eventIndex === 0}
                    className="block h-auto max-h-[75vh] w-auto max-w-full object-contain"
                  />
                  <div className="min-w-0 space-y-6">
                    <dl className="grid gap-5 text-base sm:grid-cols-2 lg:grid-cols-1">
                      <div className="space-y-1">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">When</dt>
                        <dd className="font-medium leading-relaxed text-neutral-900">
                          <time dateTime={event.event_date}>{formatDate(event.event_date)}</time>
                          {event.end_date && event.end_date !== event.event_date && (
                            <> &ndash; <time dateTime={event.end_date}>{formatDate(event.end_date)}</time></>
                          )}
                          {timeLabel && <span className="mt-1 block font-normal text-neutral-600">{timeLabel}</span>}
                        </dd>
                      </div>
                      {(event.location || address) && (
                        <div className="space-y-1">
                          <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Where</dt>
                          <dd className="leading-relaxed text-neutral-900">
                            {event.location && <span className="block font-medium">{event.location}</span>}
                            {address && <span className="block text-neutral-600">{address}</span>}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {event.details && <p className="max-w-prose whitespace-pre-line text-base leading-7 text-neutral-700">{event.details}</p>}
                    {event.sub_events.length > 0 && (
                      <div className="space-y-4 border-t border-neutral-200 pt-5">
                        <h3 className="text-lg font-semibold text-neutral-900">During this event</h3>
                        {[...event.sub_events].sort((a, b) =>
                          a.event_date.localeCompare(b.event_date) || a.start_time.localeCompare(b.start_time)
                        ).map((sub, index) => (
                          <section key={sub.id || index} className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4 text-base leading-relaxed text-neutral-700">
                            <h4 className="text-lg font-semibold text-neutral-900">{sub.title}</h4>
                            <p className="font-medium">
                              <time dateTime={sub.event_date}>{formatDate(sub.event_date)}</time>
                              {(sub.start_time || sub.end_time) && <> &middot; {formatTimeRange(sub.start_time, sub.end_time)}</>}
                            </p>
                            {sub.location && <p>{sub.location}</p>}
                            {sub.details && <p className="whitespace-pre-line leading-7">{sub.details}</p>}
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <div className="grid w-full grid-cols-1 gap-6">
        {homePaintings.map((painting, index) => (
          <figure key={painting.id} className="min-w-0 space-y-3">
            <a href="/gallery" className="block transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-white">
              <Image
                src={painting.image_url!}
                alt={painting.title ? `${painting.title} painting` : "Homepage painting"}
                width={1400} height={1400} sizes="90vw"
                priority={eventGroups.length === 0 && index === 0}
                className="block h-auto max-h-[75vh] w-auto max-w-full object-contain"
              />
            </a>
            <figcaption className="text-left text-sm font-medium text-neutral-600">
              {painting.title || "Untitled"}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
