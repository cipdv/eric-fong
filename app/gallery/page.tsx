import Image from "next/image";
import Link from "next/link";
import { sql } from "@vercel/postgres";

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
  status: string;
  prints_available: boolean;
  include_in_gallery: boolean;
  prints: Print[];
};

async function getPaintings(): Promise<Painting[]> {
  const { rows } = await sql`
    SELECT id, title, image_url, details, medium, size_original, price_original, status, prints_available, include_in_gallery
    FROM paintings
    WHERE include_in_gallery IS TRUE
    ORDER BY gallery_sort_order ASC NULLS LAST, created_at DESC NULLS LAST, title ASC;
  `;

  const paintings = await Promise.all(
    rows.map(async (row) => {
      let prints: Print[] = [];
      if (row.prints_available) {
        const printResult = await sql`
          SELECT id, size, price, quantity
          FROM prints
          WHERE painting_id = ${row.id}
          ORDER BY created_at ASC;
        `;
        prints = printResult.rows as Print[];
      }

      return {
        id: row.id as string,
        title: row.title as string,
        image_url: row.image_url as string,
        details: row.details as string,
        medium: row.medium as string,
        size_original: row.size_original as string,
        price_original: row.price_original as string,
        status: row.status as string,
        prints_available: row.prints_available as boolean,
        include_in_gallery: row.include_in_gallery as boolean,
        prints,
      };
    })
  );

  return paintings;
}

export default async function GalleryPage() {
  const paintings = await getPaintings();
  if (!paintings.length) {
    return (
      <div className="space-y-4 pb-12">
        <h2 className="text-xl font-semibold text-neutral-900">Gallery</h2>
        <p className="text-sm text-neutral-600">
          No paintings have been added yet.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-8 pb-12">
      <div className="flex items-center">
        <h2 className="text-xl font-semibold text-neutral-900">Gallery</h2>
      </div>

      <div className="space-y-16">
        {paintings.map((painting, idx) => {
          const normalizedStatus = (painting.status || "").trim().toLowerCase();
          const isAvailableForSale = normalizedStatus === "available for sale";

          return (
            <article
              key={painting.id}
              className="grid gap-8 md:grid-cols-[minmax(320px,520px)_minmax(240px,1fr)] lg:items-start"
            >
              <div className="overflow-hidden rounded border border-neutral-300 bg-white shadow-sm">
                <Image
                  src={painting.image_url || "/1_1748550734_99480.webp"}
                  alt={painting.title}
                  width={720}
                  height={720}
                  className="h-full w-full object-contain"
                  priority={idx === 0}
                />
              </div>

              <div className="space-y-4 self-center text-base leading-6 text-neutral-800">
                <h2 className="text-lg font-semibold text-neutral-900">
                  {painting.title}
                </h2>
                <div className="space-y-1 whitespace-pre-line">
                  {painting.details || "Details coming soon."}
                </div>

                <div className="space-y-1 text-sm text-neutral-700">
                  <div>
                    <span className="font-semibold text-neutral-900">
                      Medium
                    </span>
                    <div>{painting.medium || "-"}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-900">Size</span>
                    <div>{painting.size_original || "-"}</div>
                  </div>
                  {isAvailableForSale ? (
                    <div>
                      <span className="font-semibold text-neutral-900">
                        Price
                      </span>
                      <div>
                        {painting.price_original
                          ? `$${painting.price_original}`
                          : "-"}
                      </div>
                      <div className="mt-1">
                        <Link
                          href={{
                            pathname: "/contact",
                            query: {
                              message: `I'd like to purchase ${painting.title || "this painting"}`,
                            },
                          }}
                          className="text-sm text-sky-700 transition hover:text-sky-800"
                        >
                          Contact to purchase
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>

                {painting.prints_available ? (
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      Prints available:
                    </div>
                    <Link
                      href={{ pathname: "/prints", query: { paintingId: painting.id } }}
                      className="mt-2 inline-flex items-center justify-center border border-neutral-900 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
                    >
                      Purchase print
                    </Link>
                  </div>
                ) : (
                  <div className="text-sm text-neutral-600">
                    Prints not available.
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
