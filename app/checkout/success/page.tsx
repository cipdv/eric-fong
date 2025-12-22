import Link from "next/link";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function CheckoutSuccess({ searchParams }: Props) {
  await searchParams;
  return (
    <div className="space-y-4 pb-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Thanks for your purchase!
        </h1>
        <p className="text-sm text-neutral-700">
          Your order is confirmed.
        </p>
      </div>
      <div className="space-y-2">
        <Link
          href="/gallery"
          className="inline-flex items-center rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
        >
          Back to gallery
        </Link>
        <p className="text-xs text-neutral-500">
          A confirmation email will be sent if provided during checkout.
        </p>
      </div>
    </div>
  );
}
