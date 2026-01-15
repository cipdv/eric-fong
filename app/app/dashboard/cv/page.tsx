import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import CvEditor from "@/app/components/CvEditor";
import { getCvEntries } from "@/app/actions/cv";

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

export default async function CvDashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="pb-12 space-y-3">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Not authenticated
        </h1>
      </div>
    );
  }

  const entries = await getCvEntries(user.id);

  return (
    <div className="pb-12 space-y-8 mt-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Edit CV</h1>
      <CvEditor entries={entries} />
    </div>
  );
}
