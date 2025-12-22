import { sql } from "@vercel/postgres";
import { ProfileCard } from "@/app/components/ProfileCard";

const USER_ID = "151dc2dc-7c1b-4364-8422-858be726bf1b";

type UserRecord = {
  first_name: string | null;
  last_name: string | null;
  about: string | null;
  profile_photo: string | null;
};

export default async function AboutPage() {
  const { rows } = await sql<UserRecord>`
    SELECT first_name, last_name, about, profile_photo
    FROM users
    WHERE id = ${USER_ID}
    LIMIT 1;
  `;

  const user = rows[0];

  if (!user) {
    return (
      <div className="space-y-3 text-sm text-red-700">
        <p>Profile not found.</p>
      </div>
    );
  }

  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || "Eric Fong";

  return (
    <div className="mt-8 pb-12 w-full max-w-5xl ml-0 mr-auto">
      <ProfileCard
        name={fullName}
        about={user.about}
        photoUrl={user.profile_photo}
        className="mt-4"
      />
    </div>
  );
}
