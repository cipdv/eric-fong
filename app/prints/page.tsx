import Image from "next/image";
import Link from "next/link";
import { sql } from "@vercel/postgres";
import PrintPurchaseForm from "@/app/components/PrintPurchaseForm";
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
    print_quantity: number | null;
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
      pr.quantity AS print_quantity
    FROM paintings p
    LEFT JOIN prints pr ON pr.painting_id = p.id
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
        price: Number(row.print_price ?? 0),
        quantity: Number(row.print_quantity ?? 0),
      });
    }
  }

  return Array.from(byId.values());
}

type PrintsPageProps = {
  searchParams?: {
    paintingId?: string;
  };
};

export default async function PrintsPage({ searchParams }: PrintsPageProps) {
  const targetPaintingId =
    typeof searchParams?.paintingId === "string"
      ? searchParams.paintingId
      : undefined;
  const paintings = await getPaintingsWithPrints();

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
      <ScrollToPainting targetId={targetPaintingId} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Prints</h1>
        </div>
        <Link
          href="/checkout/cart"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-100"
        >
          View order
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {paintings.map((painting, idx) => (
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
                priority={idx < 2}
              />
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <h2 className="text-base font-semibold text-neutral-900">
                {painting.title || "Untitled"}
              </h2>

              <div className="mt-auto space-y-2">
                {painting.prints.length ? (
                  painting.prints.map((print) => {
                    const soldOut = print.quantity < 1;
                    return (
                      <div
                        key={print.id}
                        className="space-y-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-neutral-900">
                              {print.size || "Size coming soon"}
                            </div>
                            <div className="text-sm text-neutral-700">
                              $
                              {Number(print.price ?? 0).toLocaleString("en-CA")}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-semibold ${
                              soldOut ? "text-red-600" : "text-green-700"
                            }`}
                          >
                            {soldOut
                              ? "Sold out"
                              : `${print.quantity} available`}
                          </span>
                        </div>
                        <PrintPurchaseForm
                          printId={print.id}
                          available={Math.max(0, print.quantity)}
                        />
                      </div>
                    );
                  })
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
        ))}
      </div>
    </div>
  );
}
