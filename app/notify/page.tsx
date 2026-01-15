import { sql } from "@vercel/postgres";
import RestockRequestForm from "@/app/components/RestockRequestForm";

type PrintOption = {
  id: string;
  title: string;
  size: string | null;
  online_quantity: number;
};

type NotifyPageProps = {
  searchParams?: Promise<{
    printId?: string;
  }>;
};

async function getSoldOutPrints(): Promise<PrintOption[]> {
  const { rows } = await sql<PrintOption>`
    SELECT
      prints.id,
      prints.size,
      paintings.title,
      COALESCE(SUM(CASE WHEN l.name = 'Online shop' THEN pls.quantity END), 0) AS online_quantity
    FROM prints
    LEFT JOIN paintings ON paintings.id = prints.painting_id
    LEFT JOIN print_location_stock pls ON pls.print_id = prints.id
    LEFT JOIN locations l ON l.id = pls.location_id
    GROUP BY prints.id, prints.size, paintings.title
    HAVING COALESCE(SUM(CASE WHEN l.name = 'Online shop' THEN pls.quantity END), 0) <= 0
    ORDER BY paintings.title ASC, prints.size ASC;
  `;
  return rows.map((row) => ({
    id: String(row.id),
    title: row.title || "Untitled",
    size: row.size ?? null,
    online_quantity: Number(row.online_quantity ?? 0),
  }));
}

export default async function NotifyPage({ searchParams }: NotifyPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const targetPrintId =
    typeof resolved?.printId === "string" ? resolved.printId : undefined;
  const prints = await getSoldOutPrints();

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Restock notifications
        </h1>
        <p className="text-sm text-neutral-600">
          Choose a sold-out print and we will email you when it is back in stock.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        {prints.length ? (
          <RestockRequestForm
            prints={prints}
            initialPrintId={targetPrintId}
          />
        ) : (
          <p className="text-sm text-neutral-600">
            No sold-out prints right now.
          </p>
        )}
      </div>
    </div>
  );
}
