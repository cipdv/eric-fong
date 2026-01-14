import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import EarningsPanel from "@/app/components/EarningsPanel";
import ExpenseForm from "@/app/components/ExpenseForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Migration SQL (apply manually):
// CREATE TABLE IF NOT EXISTS tax_settings (
//   user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
//   hst_registered boolean NOT NULL DEFAULT false,
//   hst_registration_date date NULL,
//   small_supplier_threshold numeric NOT NULL DEFAULT 30000
// );

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("app_session")?.value;
  if (!token) return null;

  const { rows } = await sql`
    SELECT users.id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;

  return rows[0] ?? null;
}

type TaxSettings = {
  hst_registered: boolean;
  hst_registration_date: string | null;
  small_supplier_threshold: number;
};

async function getTaxSettings(userId: string): Promise<TaxSettings> {
  const { rows } = await sql<TaxSettings>`
    SELECT hst_registered, hst_registration_date, small_supplier_threshold
    FROM tax_settings
    WHERE user_id = ${userId}
    LIMIT 1;
  `;
  if (rows[0]) {
    return {
      hst_registered: rows[0].hst_registered,
      hst_registration_date: rows[0].hst_registration_date ?? null,
      small_supplier_threshold: Number(rows[0].small_supplier_threshold ?? 30000),
    };
  }
  const { rows: created } = await sql<TaxSettings>`
    INSERT INTO tax_settings (user_id)
    VALUES (${userId})
    RETURNING hst_registered, hst_registration_date, small_supplier_threshold;
  `;
  return {
    hst_registered: created[0]?.hst_registered ?? false,
    hst_registration_date: created[0]?.hst_registration_date ?? null,
    small_supplier_threshold: Number(created[0]?.small_supplier_threshold ?? 30000),
  };
}

async function getMonthlyEarnings(year: number) {
  const { rows } = await sql<{ month: number; earned: string | null; hst_collected: string | null }>`
    SELECT
      EXTRACT(MONTH FROM created_at)::int AS month,
      SUM(
        COALESCE(
          gross_amount,
          total_amount - COALESCE(hst_collected, 0),
          total_amount
        )
      ) AS earned,
      SUM(COALESCE(hst_collected, 0)) AS hst_collected
    FROM orders
    WHERE status IN ('paid', 'fulfilled')
      AND EXTRACT(YEAR FROM created_at) = ${year}
    GROUP BY month
    ORDER BY month ASC;
  `;
  const base = Array.from({ length: 12 }, (_, idx) => ({
    month: idx + 1,
    earned: 0,
    hstCollected: 0,
  }));
  for (const row of rows) {
    const idx = (row.month ?? 0) - 1;
    if (idx >= 0 && idx < 12) {
      base[idx].earned = Number(row.earned ?? 0);
      base[idx].hstCollected = Number(row.hst_collected ?? 0);
    }
  }
  return base;
}

type MonthlyExpenseBreakdown = {
  month: number;
  entries: {
    category: string;
    subcategory: string | null;
    details: string | null;
    spent: number;
    hstPaid: number;
  }[];
};

async function getMonthlyExpensesWithBreakdown(year: number) {
  const { rows } = await sql<{
    month: number;
    spent: string | null;
    amount_spent: string | null;
    hst_spent: string | null;
    category: string;
    subcategory: string | null;
    details: string | null;
  }>`
    SELECT
      EXTRACT(MONTH FROM date)::int AS month,
      category,
      subcategory,
      details,
      SUM(amount + COALESCE(hst, 0)) AS spent,
      SUM(amount) AS amount_spent,
      SUM(COALESCE(hst, 0)) AS hst_spent
    FROM expenses
    WHERE EXTRACT(YEAR FROM date) = ${year}
    GROUP BY month, category, subcategory, details
    ORDER BY month ASC;
  `;

  const totals = Array.from({ length: 12 }, (_, idx) => ({
    month: idx + 1,
    spent: 0,
    hstPaid: 0,
    amountBeforeHst: 0,
  }));

  const breakdown: MonthlyExpenseBreakdown[] = Array.from(
    { length: 12 },
    (_, idx) => ({ month: idx + 1, entries: [] })
  );

  for (const row of rows) {
    const idx = (row.month ?? 0) - 1;
    if (idx < 0 || idx >= 12) continue;
    const spentValue = Number(row.spent ?? 0);
    const hstPaid = Number(row.hst_spent ?? 0);
    const amountBeforeHst = Number(row.amount_spent ?? 0);
    totals[idx].spent += spentValue;
    totals[idx].hstPaid += hstPaid;
    totals[idx].amountBeforeHst += amountBeforeHst;
    breakdown[idx].entries.push({
      category: row.category,
      subcategory: row.subcategory,
      details: row.details,
      spent: spentValue,
      hstPaid: hstPaid,
    });
  }

  return { totals, breakdown };
}

type MonthlyIncomeDetails = {
  month: number;
  orders: { id: string; total: number; status: string; createdAt: string }[];
};

async function getMonthlyIncomeDetails(year: number) {
  const { rows } = await sql<{
    month: number;
    orders: { id: string; total: string; status: string; createdAt: string }[] | null;
  }>`
    SELECT
      EXTRACT(MONTH FROM created_at)::int AS month,
      JSON_AGG(
        json_build_object(
          'id', id,
          'total', total_amount,
          'status', status,
          'createdAt', created_at
        )
      ) AS orders
    FROM orders
    WHERE status IN ('paid', 'fulfilled')
      AND EXTRACT(YEAR FROM created_at) = ${year}
    GROUP BY month
    ORDER BY month ASC;
  `;

  const base: MonthlyIncomeDetails[] = Array.from({ length: 12 }, (_, idx) => ({
    month: idx + 1,
    orders: [],
  }));

  for (const row of rows) {
    const idx = (row.month ?? 0) - 1;
    if (idx >= 0 && idx < 12) {
      base[idx].orders =
        row.orders?.map((o) => ({
          id: o.id,
          total: Number(o.total ?? 0),
          status: o.status,
          createdAt: o.createdAt,
        })) ?? [];
    }
  }

  return base;
}

type ExpenseDetail = {
  date: string;
  amount: number;
  hst: number;
  category: string;
  subcategory: string | null;
  details: string | null;
};

async function getExpenseDetails(year: number): Promise<ExpenseDetail[]> {
  const { rows } = await sql<{
    date: string;
    amount: string;
    hst: string | null;
    category: string;
    subcategory: string | null;
    details: string | null;
  }>`
    SELECT date, amount, hst, category, subcategory, details
    FROM expenses
    WHERE EXTRACT(YEAR FROM date) = ${year}
    ORDER BY date DESC;
  `;
  return rows.map((row) => ({
    date: row.date,
    amount: Number(row.amount ?? 0),
    hst: Number(row.hst ?? 0),
    category: row.category,
    subcategory: row.subcategory,
    details: row.details,
  }));
}

type QuarterRevenue = { year: number; quarter: number; revenue: number };

async function getQuarterlyRevenue(fromYear: number, toYear: number) {
  const { rows } = await sql<QuarterRevenue>`
    SELECT
      EXTRACT(YEAR FROM created_at)::int AS year,
      EXTRACT(QUARTER FROM created_at)::int AS quarter,
      SUM(
        COALESCE(
          gross_amount,
          total_amount - COALESCE(hst_collected, 0),
          total_amount
        )
      ) AS revenue
    FROM orders
    WHERE status IN ('paid', 'fulfilled')
      AND EXTRACT(YEAR FROM created_at) BETWEEN ${fromYear} AND ${toYear}
    GROUP BY year, quarter
    ORDER BY year ASC, quarter ASC;
  `;
  return rows.map((row) => ({
    year: Number(row.year),
    quarter: Number(row.quarter),
    revenue: Number(row.revenue ?? 0),
  }));
}

function computeTrailingFourQuarterRevenue(
  selectedYear: number,
  quarterRows: QuarterRevenue[]
) {
  const buckets = new Map<string, number>();
  for (const row of quarterRows) {
    buckets.set(`${row.year}-Q${row.quarter}`, row.revenue);
  }
  const allQuarters = [
    { year: selectedYear - 1, quarter: 4 },
    { year: selectedYear, quarter: 1 },
    { year: selectedYear, quarter: 2 },
    { year: selectedYear, quarter: 3 },
    { year: selectedYear, quarter: 4 },
  ];
  const values = allQuarters.map((q) => buckets.get(`${q.year}-Q${q.quarter}`) ?? 0);
  const rollingSums = [
    values[0] + values[1] + values[2] + values[3],
    values[1] + values[2] + values[3] + values[4],
  ];
  const trailingRevenue = Math.max(...rollingSums);
  return { trailingRevenue };
}

export default async function FinancesDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="pb-12 space-y-3">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Not authenticated
        </h1>
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const currentYear = new Date().getUTCFullYear();
  const selectedYear =
    Number(resolvedSearchParams?.year) &&
    !Number.isNaN(Number(resolvedSearchParams?.year))
      ? Number(resolvedSearchParams?.year)
      : currentYear;

  const monthlyEarnings = await getMonthlyEarnings(selectedYear);
  const { totals: monthlyExpenses } = await getMonthlyExpensesWithBreakdown(
    selectedYear
  );
  const monthlyIncomeDetails = await getMonthlyIncomeDetails(selectedYear);
  const expenseDetails = await getExpenseDetails(selectedYear);
  const earnings = monthlyEarnings.reduce(
    (sum, m) => sum + m.earned + m.hstCollected,
    0
  );
  const expenses = monthlyExpenses.reduce((sum, m) => sum + m.spent, 0);
  const hstCollectedTotal = monthlyEarnings.reduce(
    (sum, m) => sum + m.hstCollected,
    0
  );
  const hstPaidTotal = monthlyExpenses.reduce((sum, m) => sum + m.hstPaid, 0);
  const taxSettings = await getTaxSettings(user.id);
  const quarterRows = await getQuarterlyRevenue(selectedYear - 1, selectedYear);
  // Uses the max rolling sum of 4 consecutive quarters within the selected year window.
  const { trailingRevenue } = computeTrailingFourQuarterRevenue(
    selectedYear,
    quarterRows
  );
  const smallSupplier = trailingRevenue <= taxSettings.small_supplier_threshold;

  const years = [
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
    currentYear - 4,
  ];

  return (
    <div className="pb-12 space-y-6 mt-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Manage finances</h1>
      <div className="space-y-2">
        <details className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-neutral-900">
            Add expense
          </summary>
          <div className="border-t border-neutral-200 px-4 py-3">
            <ExpenseForm />
          </div>
        </details>
      </div>
      <EarningsPanel
        selectedYear={selectedYear}
        years={years}
        totalEarnings={earnings}
        totalExpenses={expenses}
        totalHstCollected={hstCollectedTotal}
        totalHstPaid={hstPaidTotal}
        monthlyIncomeDetails={monthlyIncomeDetails}
        expenseDetails={expenseDetails}
        hstRegistered={taxSettings.hst_registered}
        hstRegistrationDate={taxSettings.hst_registration_date}
        smallSupplier={smallSupplier}
      />
    </div>
  );
}
