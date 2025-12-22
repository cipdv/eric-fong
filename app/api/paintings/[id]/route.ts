import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getUserFromSession() {
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

  return rows[0]?.id as string | undefined;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserFromSession();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: paintingId } = await params;
    const body = await request.json();
    const { title, details, medium, size_original, price_original, prints, is_home_image } =
      body;

    try {
      await sql`
        UPDATE paintings
        SET title = ${title},
            details = ${details},
            medium = ${medium},
            size_original = ${size_original},
            price_original = ${price_original},
            is_home_image = ${is_home_image}
        WHERE id = ${paintingId};
      `;
    } catch (err) {
      await sql`
        UPDATE paintings
        SET title = ${title},
            details = ${details},
            medium = ${medium},
            size_original = ${size_original},
            price_original = ${price_original}
        WHERE id = ${paintingId};
      `;
    }

    if (is_home_image) {
      try {
        await sql`
          UPDATE paintings
          SET is_home_image = FALSE
          WHERE id <> ${paintingId};
        `;
      } catch {
        // column might not exist yet; ignore
      }
    }

    if (Array.isArray(prints)) {
      for (const pr of prints) {
        if (!pr?.id) continue;
        await sql`
          UPDATE prints
          SET price = ${pr.price}, size = ${pr.size}
          WHERE id = ${pr.id} AND painting_id = ${paintingId};
        `;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update painting error", error);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserFromSession();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: paintingId } = await params;

    await sql`DELETE FROM prints WHERE painting_id = ${paintingId};`;
    await sql`DELETE FROM paintings WHERE id = ${paintingId};`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete painting error", error);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
