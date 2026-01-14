import Image from "next/image";
import { sql } from "@vercel/postgres";

type Painting = {
  image_url: string | null;
  title: string | null;
};

async function getHomePainting(): Promise<Painting | null> {
  try {
    const { rows } = await sql`
      SELECT image_url, title
      FROM paintings
      WHERE is_home_image = TRUE
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    if (rows[0]) return rows[0] as Painting;
  } catch {
    // if column doesn't exist, fall through to fallback query
  }

  const fallback = await sql`
    SELECT image_url, title
    FROM paintings
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  return fallback.rows[0] as Painting | null;
}

export default function Home() {
  const paintingPromise = getHomePainting();
  return (
    <div className="flex w-full justify-center sm:justify-start pb-12 px-4 sm:px-6">
      <HomeImage paintingPromise={paintingPromise} />
    </div>
  );
}

async function HomeImage({
  paintingPromise,
}: {
  paintingPromise: Promise<Painting | null>;
}) {
  const painting = await paintingPromise;
  const src = painting?.image_url || "/1_1748550734_99480.webp";
  const title = painting?.title || "Untitled";
  return (
    <div className="inline-flex flex-col items-start space-y-3">
      <a href="/gallery" className="block transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-white">
        <Image
          src={src}
          alt={title ? `${title} painting` : "Homepage painting"}
          width={1400}
          height={1400}
          className="block h-auto max-h-[75vh] w-auto max-w-full sm:max-w-[80vw] object-contain"
          priority
        />
      </a>
      <p className="text-left text-sm font-medium text-neutral-600">
        {title}
      </p>
    </div>
  );
}
