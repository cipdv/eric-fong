import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import UploadPaintingForm from "@/app/components/UploadPaintingForm";
import GalleryEditor from "@/app/components/GalleryEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Location = {
  id: string;
  name: string;
  notes: string | null;
};

type PrintLocation = {
  location_id: string;
  location_name: string | null;
  quantity: number;
};

type Print = {
  id: string;
  size: string;
  price: string;
  quantity: number;
  location_stock?: PrintLocation[];
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
  is_home_page?: boolean | null;
  status?: string;
  location_id?: string | null;
  location_name?: string | null;
  location_start_date?: string | null;
  location_end_date?: string | null;
  location_commission_rate?: string | null;
  sold_customer_name?: string | null;
  sold_price?: string | null;
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

function normalizeDateInput(value: unknown) {
  if (!value) return null;
  const raw = String(value);
  if (raw.includes("T")) return raw.split("T")[0];
  if (raw.includes(" ")) return raw.split(" ")[0];
  return raw;
}

async function getPaintings(userId: string): Promise<Painting[]> {
  const { rows } = await sql`
    SELECT
      p.id,
      p.title,
      p.image_url,
      p.details,
      p.medium,
      p.size_original,
      p.price_original,
      p.prints_available,
      p.created_at,
      p.status,
      p.is_home_image,
      p.sale_order_id,
      p.location_id,
      to_char(p.location_start_date, 'YYYY-MM-DD') AS location_start_date,
      to_char(p.location_end_date, 'YYYY-MM-DD') AS location_end_date,
      p.location_commission_rate,
      l.name AS location_name,
      o.customer_first_name,
      o.customer_last_name,
      o.total_amount AS sold_price
    FROM paintings p
    LEFT JOIN locations l ON l.id = p.location_id
    LEFT JOIN orders o ON o.id = p.sale_order_id
    WHERE p.user_id = ${userId}
    ORDER BY p.created_at DESC;
  `;

  const paintings = await Promise.all(
    rows.map(async (row) => {
      let printRows: {
        id: string;
        size: string;
        price: string;
        quantity: number;
        location_id: string | null;
        location_quantity: number | null;
        location_name: string | null;
      }[];

      try {
        const printResult = await sql<{
          id: string;
          size: string;
          price: string;
          quantity: number;
          location_id: string | null;
          location_quantity: number | null;
          location_name: string | null;
        }>`
          SELECT
            prints.id,
            prints.size,
            prints.price,
            prints.quantity,
            pls.location_id,
            pls.quantity AS location_quantity,
            loc.name AS location_name
          FROM prints
          LEFT JOIN print_location_stock AS pls ON pls.print_id = prints.id
          LEFT JOIN locations AS loc ON loc.id = pls.location_id
          WHERE painting_id = ${row.id}
          ORDER BY prints.created_at ASC, loc.name ASC NULLS LAST;
        `;
        printRows = printResult.rows;
      } catch (err) {
        const fallbackPrints = await sql<{
          id: string;
          size: string;
          price: string;
          quantity: number;
        }>`
          SELECT id, size, price, quantity
          FROM prints
          WHERE painting_id = ${row.id}
          ORDER BY created_at ASC;
        `;
        printRows = fallbackPrints.rows.map((pr) => ({
          ...pr,
          location_id: null,
          location_quantity: null,
          location_name: null,
        }));
      }

      const grouped = new Map<
        string,
        Print & {
          location_stock: PrintLocation[];
        }
      >();

      for (const pr of printRows) {
        if (!grouped.has(pr.id)) {
          grouped.set(pr.id, {
            id: pr.id,
            size: pr.size,
            price: pr.price,
            quantity: Number(pr.quantity ?? 0),
            location_stock: [],
          });
        }
        if (pr.location_id) {
          grouped.get(pr.id)!.location_stock!.push({
            location_id: pr.location_id,
            location_name: pr.location_name,
            quantity: Number(pr.location_quantity ?? 0),
          });
        }
      }

      const printList = Array.from(grouped.values());

      return {
        id: row.id as string,
        title: row.title as string,
        image_url: row.image_url as string,
        details: row.details as string,
        medium: row.medium as string,
        size_original: row.size_original as string,
        price_original: row.price_original as string,
        prints: printList,
        is_home_image: (row.is_home_image ?? row.is_home_page) as boolean | undefined,
        status: row.status as string | undefined,
        location_id: row.location_id ? String(row.location_id) : null,
        location_name: row.location_name as string | null,
        location_start_date: row.location_start_date
          ? String(row.location_start_date)
          : null,
        location_end_date: row.location_end_date ? String(row.location_end_date) : null,
        location_commission_rate:
          row.location_commission_rate !== null &&
          row.location_commission_rate !== undefined
            ? String(row.location_commission_rate)
            : null,
        sold_customer_name:
          row.customer_first_name || row.customer_last_name
            ? `${row.customer_first_name ?? ""} ${row.customer_last_name ?? ""}`.trim()
            : null,
        sold_price:
          row.sold_price !== null && row.sold_price !== undefined
            ? String(row.sold_price)
            : null,
      };
    })
  );

  return paintings;
}

async function getLocations(): Promise<Location[]> {
  const { rows } = await sql`
    SELECT
      id,
      name,
      notes,
      address_line1,
      address_line2,
      city,
      province,
      postal,
      country,
      contact_name,
      contact_phone,
      contact_email,
      start_date,
      end_date,
      commission_rate
    FROM locations
    ORDER BY name ASC;
  `;
  return rows as Location[];
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

  const [paintings, locations] = await Promise.all([
    getPaintings(user.id),
    getLocations(),
  ]);
  if (process.env.NODE_ENV !== "production") {
    console.log("[GalleryDashboardPage] location dates sample", {
      location_start_date: paintings[0]?.location_start_date ?? null,
      location_end_date: paintings[0]?.location_end_date ?? null,
    });
  }

  return (
    <div className="pb-12 space-y-8 mt-8">
      <h1 className="text-2xl font-semibold text-neutral-900">
        Manage gallery
      </h1>
      <div className="space-y-4">
        <UploadPaintingForm locations={locations} />
      </div>

      <div className="space-y-4">
        <GalleryEditor paintings={paintings} locations={locations} />
      </div>
    </div>
  );
}
