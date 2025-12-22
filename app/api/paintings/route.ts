import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import crypto from "node:crypto";

async function getUserFromSession(appSession?: string | undefined | null) {
  if (!appSession) return null;

  const { rows } = await sql`
    SELECT users.id, users.first_name
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${appSession}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;

  return rows[0] ?? null;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("app_session");

    const user = await getUserFromSession(sessionCookie?.value);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const title = form.get("title")?.toString().trim() ?? "";
    const details = form.get("details")?.toString().trim() ?? "";
    const medium = form.get("medium")?.toString().trim() ?? "";
    const sizeOriginalHeight =
      form.get("sizeOriginalHeight")?.toString().trim() ?? "";
    const sizeOriginalWidth =
      form.get("sizeOriginalWidth")?.toString().trim() ?? "";
    const priceOriginal = form.get("priceOriginal")?.toString().trim() ?? "";
    const printsAvailable =
      form.get("printsAvailable")?.toString().toLowerCase() === "true";
    const printsRaw = form.get("prints")?.toString() ?? "[]";
    const imageFile = form.get("image");

    if (
      !title ||
      !details ||
      !medium ||
      !sizeOriginalHeight ||
      !sizeOriginalWidth ||
      !priceOriginal ||
      !(imageFile instanceof File)
    ) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    let prints: any[] = [];
    if (printsAvailable) {
      try {
        prints = JSON.parse(printsRaw);
      } catch {
        return NextResponse.json(
          { error: "Invalid prints payload." },
          { status: 400 }
        );
      }
    }

    const blob = await put(
      `paintings/${crypto.randomUUID()}-${imageFile.name}`,
      imageFile,
      {
        access: "public",
        contentType: imageFile.type,
      }
    );

    const insertedPainting = await sql`
      INSERT INTO paintings
        (user_id, title, image_url, details, medium, size_original, price_original, status, prints_available)
      VALUES
        (${user.id}, ${title}, ${blob.url}, ${details}, ${medium}, ${`${sizeOriginalWidth} x ${sizeOriginalHeight} in`}, ${priceOriginal}, 'available for sale', ${printsAvailable})
      RETURNING id;
    `;

    const paintingId = insertedPainting.rows[0].id;

    if (printsAvailable && Array.isArray(prints) && prints.length > 0) {
      for (const print of prints) {
        if (
          !print?.width ||
          !print?.height ||
          !print?.price ||
          print.quantity === undefined
        ) {
          continue;
        }
        await sql`
          INSERT INTO prints (painting_id, size, price, quantity)
          VALUES (${paintingId}, ${`${print.width} x ${print.height} in`}, ${print.price}, ${print.quantity});
        `;
      }
    }

    return NextResponse.json({ ok: true, paintingId });
  } catch (error) {
    console.error("Upload error", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
