import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("app_session")?.value;
  if (!token) {
    return NextResponse.json({ loggedIn: false });
  }

  const { rows } = await sql`
    SELECT users.id, users.first_name
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;

  const user = rows[0];
  if (!user) {
    return NextResponse.json({ loggedIn: false });
  }

  return NextResponse.json({
    loggedIn: true,
    user: { id: user.id, firstName: user.first_name },
  });
}
