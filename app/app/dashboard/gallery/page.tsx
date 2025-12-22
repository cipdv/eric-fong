import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import UploadPaintingForm from "@/app/components/UploadPaintingForm";
import GalleryEditor from "@/app/components/GalleryEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Print = {
  id: string;
  size: string;
  price: string;
  quantity: number;
};

type Painting = {
  id: string;
  title: string;
  image_url: string;
  details: string;
  medium: string;
  size_original: string;
  price_original: string;
  prints: Print[];
  is_home_image?: boolean;
  status?: string;
};

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

async function getPaintings(): Promise<Painting[]> {
  let rows;
  try {
    const result = await sql`
      SELECT id, title, image_url, details, medium, size_original, price_original, is_home_image, status
      FROM paintings
      ORDER BY created_at DESC NULLS LAST, title ASC;
    `;
    rows = result.rows;
  } catch (err) {
    const fallback = await sql`
      SELECT id, title, image_url, details, medium, size_original, price_original, status
      FROM paintings
      ORDER BY created_at DESC NULLS LAST, title ASC;
    `;
    rows = fallback.rows.map((row) => ({
      ...row,
      is_home_image: false,
    }));
  }

  const paintings = await Promise.all(
    rows.map(async (row) => {
      const printResult = await sql`
        SELECT id, size, price, quantity
        FROM prints
        WHERE painting_id = ${row.id}
        ORDER BY created_at ASC;
      `;

      return {
        id: row.id as string,
        title: row.title as string,
        image_url: row.image_url as string,
        details: row.details as string,
        medium: row.medium as string,
        size_original: row.size_original as string,
        price_original: row.price_original as string,
        prints: printResult.rows as Print[],
        is_home_image: row.is_home_image as boolean | undefined,
        status: row.status as string | undefined,
      };
    })
  );

  return paintings;
}

export default async function GalleryDashboardPage() {
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

  const paintings = await getPaintings();

  return (
    <div className="pb-12 space-y-8 mt-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Manage gallery</h1>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Add new</h2>
        <UploadPaintingForm />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Edit existing</h2>
        <GalleryEditor paintings={paintings} />
      </div>
    </div>
  );
}
