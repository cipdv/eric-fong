import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import ProfileEditor from "@/app/components/ProfileEditor";

async function getCurrentUser() {
  const token = cookies().get("app_session")?.value;
  if (!token) return null;

  const { rows } = await sql`
    SELECT users.id, users.first_name, users.about, users.profile_photo
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;

  return rows[0] ?? null;
}

export default async function ProfileDashboardPage() {
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

  return (
    <div className="pb-12 space-y-8 mt-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Edit profile</h1>
      <ProfileEditor
        initialAbout={user.about as string | undefined}
        initialPhoto={user.profile_photo as string | undefined}
      />
    </div>
  );
}
