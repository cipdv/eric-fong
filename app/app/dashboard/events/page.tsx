import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import EventsEditor from "@/app/components/EventsEditor";
import { getEventsAction } from "@/app/actions/events";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("app_session")?.value;
  if (!token) return null;

  const { rows } = await sql`
    SELECT users.id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;

  return rows[0] ?? null;
}

export default async function EventsDashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="pb-12 space-y-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Not authenticated</h1>
      </div>
    );
  }

  const [events, galleryImages] = await Promise.all([
    getEventsAction(),
    sql<{ id: string; title: string | null; image_url: string }>`
      SELECT id, title, image_url
      FROM paintings
      WHERE user_id = ${user.id}
        AND image_url IS NOT NULL
      ORDER BY created_at DESC;
    `,
  ]);

  return (
    <div className="pb-12 space-y-6 mt-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Update events</h1>
      <EventsEditor initialEvents={events} galleryImages={galleryImages.rows} />
    </div>
  );
}
