import Image from "next/image";
import { sql } from "@vercel/postgres";
import PrintSizeSelector from "@/app/components/PrintSizeSelector";
import PrintsCartBanner from "@/app/components/PrintsCartBanner";
import ScrollToPainting from "./ScrollToPainting";

type Print = {
  id: string;
  size: string | null;
  price: number;
  quantity: number;
};

type Painting = {
  id: string;
  title: string;
  image_url: string | null;
  details: string | null;
  prints_available: boolean;
  prints: Print[];
};

async function getPaintingsWithPrints(): Promise<Painting[]> {
  const { rows } = await sql<{
    painting_id: string;
    painting_title: string;
    painting_image_url: string | null;
    painting_details: string | null;
    painting_prints_available: boolean | null;
    print_id: string | null;
    print_size: string | null;
    print_price: string | null;
    print_online_price: string | null;
    print_online_quantity: number | null;
  }>`
    SELECT
      p.id AS painting_id,
      p.title AS painting_title,
      p.image_url AS painting_image_url,
      p.details AS painting_details,
      p.prints_available AS painting_prints_available,
      pr.id AS print_id,
      pr.size AS print_size,
      pr.price AS print_price,
      COALESCE(
        MAX(CASE WHEN l.name = 'Online shop' THEN pls.price_override END),
        pr.price
      ) AS print_online_price,
      COALESCE(SUM(CASE WHEN l.name = 'Online shop' THEN pls.quantity END), 0) AS print_online_quantity
    FROM paintings p
    LEFT JOIN prints pr ON pr.painting_id = p.id
    LEFT JOIN print_location_stock pls ON pls.print_id = pr.id
    LEFT JOIN locations l ON l.id = pls.location_id
    GROUP BY
      p.id,
      p.title,
      p.image_url,
      p.details,
      p.prints_available,
      pr.id,
      pr.size,
      pr.price
    ORDER BY p.created_at DESC NULLS LAST, p.title ASC, pr.created_at ASC NULLS LAST;
  `;

  const byId = new Map<string, Painting>();

  for (const row of rows) {
    if (!byId.has(row.painting_id)) {
      byId.set(row.painting_id, {
        id: row.painting_id,
        title: row.painting_title,
        image_url: row.painting_image_url,
        details: row.painting_details,
        prints_available: Boolean(row.painting_prints_available),
        prints: [],
      });
    }

    if (row.print_id) {
      const painting = byId.get(row.painting_id)!;
      painting.prints.push({
        id: row.print_id,
        size: row.print_size,
        price: Number(row.print_online_price ?? row.print_price ?? 0),
        quantity: Number(row.print_online_quantity ?? 0),
      });
    }
  }

  const paintings = Array.from(byId.values());
  paintings.sort((a, b) => {
    const aHasStock = a.prints.some((print) => print.quantity > 0);
    const bHasStock = b.prints.some((print) => print.quantity > 0);
    if (aHasStock === bHasStock) return 0;
    return aHasStock ? -1 : 1;
  });
  return paintings;
}

type PrintsPageProps = {
  searchParams?: Promise<{
    paintingId?: string;
  }>;
};

export default async function PrintsPage({ searchParams }: PrintsPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const targetPaintingId =
    typeof resolved?.paintingId === "string"
      ? resolved.paintingId
      : undefined;
  const paintings = await getPaintingsWithPrints();
  const cartCatalog = paintings.flatMap((painting) =>
    painting.prints.map((print) => ({
      printId: print.id,
      paintingTitle: painting.title || "Untitled",
      size: print.size || "Size coming soon",
      price: Number(print.price ?? 0),
    }))
  );

  if (!paintings.length) {
    return (
      <div className="space-y-3 pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900">Prints</h1>
        <p className="text-sm text-neutral-600">No paintings available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PrintsCartBanner catalog={cartCatalog} />
      <ScrollToPainting targetId={targetPaintingId} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Prints</h1>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {paintings.map((painting, idx) => {
          const isTarget = targetPaintingId === painting.id;
          const shouldPrioritize = isTarget || (!targetPaintingId && idx < 2);
          return (
          <article
            key={painting.id}
            id={`painting-${painting.id}`}
            className="flex h-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
          >
            <div className="relative aspect-[4/5] w-full bg-neutral-50">
              <Image
                src={painting.image_url || "/1_1748550734_99480.webp"}
                alt={painting.title || "Painting"}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="object-contain"
                priority={shouldPrioritize}
              />
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <h2 className="text-base font-semibold text-neutral-900">
                {painting.title || "Untitled"}
              </h2>

              <div className="mt-3 space-y-2">
                {painting.prints.length ? (
                  <PrintSizeSelector prints={painting.prints} />
                ) : (
                  <p className="text-sm text-neutral-600">
                    {painting.prints_available
                      ? "Print details coming soon."
                      : "Prints not available for this painting."}
                  </p>
                )}
              </div>
            </div>
          </article>
        );
        })}
      </div>
    </div>
  );
}
