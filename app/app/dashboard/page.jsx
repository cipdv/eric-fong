import { cookies } from "next/headers";
import Link from "next/link";
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
    SELECT users.id, users.first_name
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${sessionCookie.value}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;
  const user = rows[0];
  const firstName = user?.first_name ?? "friend";
  const userId = user?.id;

  return (
    <div className="pb-12 space-y-4 mt-8">
      <h1 className="text-3xl font-semibold text-neutral-900">
        Hi {firstName}
      </h1>
      <p className="text-base text-neutral-800">New painting orders</p>
    </div>
  );
}
