import Image from "next/image";
import { sql } from "@vercel/postgres";

type Painting = {
  image_url: string | null;
  title: string | null;
};

type EventRecord = {
  id: string;
  name: string;
  event_date: string;
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

async function getHomePainting(): Promise<Painting | null> {
  try {
    const { rows } = await sql`
      SELECT image_url, title
      FROM paintings
      WHERE is_home_image = TRUE
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    if (rows[0]) return rows[0] as Painting;
  } catch {
    // if column doesn't exist, fall through to fallback query
  }

  const fallback = await sql`
    SELECT image_url, title
    FROM paintings
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  return fallback.rows[0] as Painting | null;
}

async function getUpcomingEvents(): Promise<EventRecord[]> {
  try {
    const { rows } = await sql<EventRecord>`
      SELECT
        id,
        name,
        to_char(event_date, 'YYYY-MM-DD') AS event_date,
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
      WHERE event_date >= CURRENT_DATE
      ORDER BY event_date ASC, start_time ASC NULLS LAST, created_at DESC;
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
  const paintingPromise = getHomePainting();
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
  paintingPromise: Promise<Painting | null>;
  eventsPromise: Promise<EventRecord[]>;
  fallbackImagePromise: Promise<string | null>;
}) {
  const painting = await paintingPromise;
  const events = await eventsPromise;
  const fallbackImage = await fallbackImagePromise;
  const src = painting?.image_url || "/1_1748550734_99480.webp";
  const title = painting?.title || "Untitled";
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

  return (
    <div className="inline-flex flex-col items-start space-y-3">
      <a href="/gallery" className="block transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-white">
        <Image
          src={src}
          alt={title ? `${title} painting` : "Homepage painting"}
          width={1400}
          height={1400}
          className="block h-auto max-h-[75vh] w-auto max-w-full sm:max-w-[80vw] object-contain"
          priority
        />
      </a>
      <p className="text-left text-sm font-medium text-neutral-600">
        {title}
      </p>
      {events.length ? (
        <div className="mt-8 w-full max-w-3xl space-y-5">
          <div className="text-xl font-semibold text-neutral-900 sm:text-2xl">
            Upcoming events
          </div>
          <div className="space-y-4">
            {events.map((event) => {
              const timeLabel = formatTimeRange(event.start_time, event.end_time);
              const streetLine = [event.street_number, event.street_name]
                .filter(Boolean)
                .join(" ");
              const cityLine = [event.city, event.province].filter(Boolean).join(", ");
              const eventImage =
                event.image_url || fallbackImage || "/1_1748550734_99480.webp";
              return (
                <div
                  key={event.id}
                  className="flex flex-col gap-4 border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start"
                >
                  <div className="relative flex h-44 w-full shrink-0 items-center justify-center bg-neutral-100 sm:h-36 sm:w-48">
                    <Image
                      src={eventImage}
                      alt={event.name}
                      width={384}
                      height={288}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="space-y-1 text-sm font-medium text-neutral-800">
                    <div className="text-lg font-semibold text-neutral-900 sm:text-xl">
                      {event.name}
                    </div>
                    <div className="space-y-0.5 text-sm font-medium text-neutral-800">
                      <div>{formatDate(event.event_date)}</div>
                      {timeLabel ? (
                        <div>{timeLabel}</div>
                      ) : (
                        <div className="text-neutral-600">All day</div>
                      )}
                    </div>
                    {event.details ? (
                      <div className="pt-2 text-sm font-medium text-neutral-800 leading-relaxed">
                        {event.details}
                      </div>
                    ) : null}
                    {event.location || streetLine || cityLine ? (
                      <div className="pt-3 space-y-0.5 text-sm font-medium text-neutral-800">
                        {event.location ? (
                          <div className="font-semibold text-neutral-800">
                            {event.location}
                          </div>
                        ) : null}
                        {streetLine ? <div>{streetLine}</div> : null}
                        {cityLine ? <div>{cityLine}</div> : null}
                      </div>
                    ) : null}
                    <div className="pt-3">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center border border-neutral-900 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
                      >
                        RSVP
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
