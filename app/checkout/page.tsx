import CheckoutForm from "@/app/components/CheckoutForm";
import Image from "next/image";
import { sql } from "@vercel/postgres";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function getPrint(printId: string) {
  const { rows } = await sql`
    SELECT prints.id, prints.size, prints.price, prints.quantity, paintings.title, paintings.image_url
    FROM prints
    JOIN paintings ON paintings.id = prints.painting_id
    WHERE prints.id = ${printId}
    LIMIT 1;
  `;
  return rows[0] ?? null;
}

export default async function CheckoutPage({ searchParams }: Props) {
  const params = await searchParams;
  const printId = Array.isArray(params.printId)
    ? params.printId[0]
    : params.printId ?? "";
  const qtyParam = Array.isArray(params.quantity)
    ? params.quantity[0]
    : params.quantity ?? "1";

  const quantity = Math.max(1, Number(qtyParam) || 1);

  if (!printId) {
    return (
      <div className="space-y-3 pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900">Checkout</h1>
        <p className="text-sm text-neutral-600">No print selected.</p>
      </div>
    );
  }

  const print = await getPrint(printId);

  if (!print) {
    return (
      <div className="space-y-3 pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900">Checkout</h1>
        <p className="text-sm text-neutral-600">Print not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900">Checkout</h1>
        <p className="text-sm text-neutral-600">
          {print.title} — {print.size}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(320px,480px)_minmax(320px,1fr)] lg:items-start">
        <div className="overflow-hidden rounded border border-neutral-200 bg-white shadow-sm">
          <Image
            src={print.image_url || "/1_1748550734_99480.webp"}
            alt={print.title}
            width={800}
            height={800}
            className="h-full w-full object-contain"
            priority
          />
        </div>
        <CheckoutForm
          printId={print.id}
          printSize={print.size}
          unitPrice={Number(print.price)}
          available={print.quantity}
          defaultQuantity={quantity}
        />
      </div>
    </div>
  );
}
