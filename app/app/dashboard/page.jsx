import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("app_session");

  if (!sessionCookie) {
    return (
      <div className="pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Not authenticated
        </h1>
      </div>
    );
  }

  const { rows } = await sql`
    SELECT users.first_name
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${sessionCookie.value}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;
  const firstName = rows[0]?.first_name ?? "friend";

  return (
    <div className="pb-12">
      <h1 className="text-3xl font-semibold text-neutral-900">
        Hi {firstName}, you fucking pig slut
      </h1>
    </div>
  );
}
