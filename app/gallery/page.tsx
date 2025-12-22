import Image from "next/image";
import Link from "next/link";
import { sql } from "@vercel/postgres";
import PrintPurchaseForm from "@/app/components/PrintPurchaseForm";

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
  prints: Print[];
};

async function getPaintings(): Promise<Painting[]> {
  const { rows } = await sql`
    SELECT id, title, image_url, details, medium, size_original, price_original, status, prints_available
    FROM paintings
    ORDER BY created_at DESC NULLS LAST, title ASC;
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
        prints,
      };
    })
  );

  return paintings;
}

function formatSize(size: string) {
  if (!size) return "";
  const cleaned = size.replace(/"/g, "").replace(/in/gi, "");
  const parts = cleaned.split("x").map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => `${p}″`).join(" x ");
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
    <div className="space-y-16 pb-12">
      {paintings.map((painting, idx) => (
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
              <p className="font-semibold text-neutral-900">Medium</p>
              <p>{painting.medium}</p>
              <p>{formatSize(painting.size_original)}</p>
            </div>

            <div className="space-y-2 pt-2">
              <p className="font-semibold text-neutral-900">
                Price of original: ${Number(painting.price_original).toLocaleString("en-CA")}
              </p>
              <p className="text-sm text-neutral-700">
                {painting.status === "sold" && "Sold"}
                {painting.status === "not available for sale" &&
                  "Not available for sale"}
                {painting.status === "available for sale" && (
                  <Link
                    href="/contact"
                    className="text-sky-700 underline underline-offset-4"
                  >
                    Contact to purchase
                  </Link>
                )}
              </p>
            </div>

            {painting.prints_available && painting.prints.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="font-semibold text-neutral-900">
                  Prints available:
                </p>
                <div className="space-y-1">
                  {painting.prints.map((print) => (
                    <div
                      key={print.id}
                      className="flex flex-wrap items-center gap-3"
                    >
                      <p className="m-0">
                        {formatSize(print.size)}: ${Number(print.price).toLocaleString("en-CA")}
                      </p>
                      <PrintPurchaseForm
                        printId={print.id}
                        available={print.quantity}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
