import Image from "next/image";

type Painting = {
  id: number;
  title: string;
  medium: string;
  originalPrice: string;
  prints: { size: string; price: string }[];
  details: string[];
};

const paintings: Painting[] = Array.from({ length: 4 }, (_, idx) => ({
  id: idx + 1,
  title: "Title of painting",
  medium: "Oil on canvas",
  originalPrice: "$900",
  prints: [
    { size: "8.5 x 11", price: "$50" },
    { size: "11 x 17", price: "$100" },
  ],
  details: [
    "Details of the painting.",
    "Details of the painting.",
    "Details of the painting.",
  ],
}));

export default function GalleryPage() {
  return (
    <div className="space-y-16 pb-12">
      {paintings.map((painting) => (
        <article
          key={painting.id}
          className="grid gap-8 md:grid-cols-[minmax(320px,520px)_minmax(240px,1fr)] lg:items-start"
        >
          <div className="overflow-hidden rounded border border-neutral-300 bg-white shadow-sm">
            <Image
              src="/1_1748550734_99480.webp"
              alt={`${painting.title} placeholder`}
              width={720}
              height={720}
              className="h-full w-full object-contain"
              priority={painting.id === 1}
            />
          </div>

          <div className="space-y-4 self-center text-base leading-6 text-neutral-800">
            <h2 className="text-lg font-semibold text-neutral-900">
              {painting.title}
            </h2>
            <div className="space-y-1">
              {painting.details.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <p className="font-semibold text-neutral-900">
                Price of original: {painting.originalPrice}
              </p>
              <button className="rounded-sm bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700">
                Purchase original
              </button>
            </div>

            <div className="space-y-2 pt-2">
              <p className="font-semibold text-neutral-900">Prints available:</p>
              <div className="space-y-1">
                {painting.prints.map((print) => (
                  <p key={print.size}>
                    {print.size}: {print.price}
                  </p>
                ))}
              </div>
              <button className="rounded-sm bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700">
                Purchase print
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
