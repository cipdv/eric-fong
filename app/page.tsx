import Image from "next/image";
import { sql } from "@vercel/postgres";

type Painting = {
  image_url: string | null;
};

async function getHomePainting(): Promise<Painting | null> {
  try {
    const { rows } = await sql`
      SELECT image_url
      FROM paintings
      WHERE is_home_image = TRUE
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    if (rows[0]) return rows[0] as Painting;
  } catch (err) {
    // if column doesn't exist, fall through to fallback query
  }

  const fallback = await sql`
    SELECT image_url
    FROM paintings
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  return fallback.rows[0] as Painting | null;
}

export default function Home() {
  const paintingPromise = getHomePainting();
  return (
    <div className="pb-12">
      <div className="w-full max-w-6xl overflow-hidden ml-0 mr-auto lg:-ml-8">
        <HomeImage paintingPromise={paintingPromise} />
      </div>
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
  return (
    <Image
      src={src}
      alt="Homepage painting"
      width={1400}
      height={1400}
      className="h-full w-full max-h-[85vh] object-contain"
      priority
    />
  );
}
