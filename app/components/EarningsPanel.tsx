"use client";

import { useMemo } from "react";
import YearSelector from "@/app/components/YearSelector";

type Props = {
  selectedYear: number;
  years: number[];
  totalEarnings: number; // income + HST collected
  totalExpenses: number; // expenses incl HST paid
  totalHstCollected: number;
  totalHstPaid: number;
  hstRegistered: boolean;
  hstRegistrationDate: string | null;
  smallSupplier: boolean;
  monthlyIncomeDetails: {
    month: number;
    orders: { id: string; total: number; status: string; createdAt: string }[];
  }[];
  expenseDetails: {
    date: string;
    amount: number;
    hst: number;
    category: string;
    subcategory: string | null;
    details: string | null;
  }[];
};

export default function EarningsPanel({
  selectedYear,
  years,
  totalEarnings,
  totalExpenses,
  totalHstCollected,
  totalHstPaid,
  hstRegistered,
  hstRegistrationDate,
  smallSupplier,
  monthlyIncomeDetails,
  expenseDetails,
}: Props) {
  const formatCurrency = (value: number) =>
    value.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

  const incomeItems = useMemo(() => {
    return monthlyIncomeDetails
      .flatMap((m) => m.orders)
      .map((order) => ({
        id: order.id,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [monthlyIncomeDetails]);

  const expenseGroups = useMemo(() => {
    const grouped = new Map<
      string,
      { label: string; total: number; items: typeof expenseDetails }
    >();
    for (const expense of expenseDetails) {
      const label = expense.subcategory
        ? `${expense.category} - ${expense.subcategory}`
        : expense.category;
      const lineTotal = expense.amount + (expense.hst ?? 0);
      const entry = grouped.get(label);
      if (entry) {
        entry.total += lineTotal;
        entry.items.push(expense);
      } else {
        grouped.set(label, { label, total: lineTotal, items: [expense] });
      }
    }
    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenseDetails]);

  const hstCalculationsDisabled = !hstRegistered && smallSupplier;
  const effectiveHstCollected = hstCalculationsDisabled ? 0 : totalHstCollected;
  const effectiveHstPaid = hstCalculationsDisabled ? 0 : totalHstPaid;
  const cashNetInclHst = totalEarnings - totalExpenses;
  const revenueBeforeHst = hstCalculationsDisabled
    ? totalEarnings
    : totalEarnings - totalHstCollected;
  const expensesBeforeHst = hstCalculationsDisabled
    ? totalExpenses
    : totalExpenses - totalHstPaid;
  const netHst = effectiveHstCollected - effectiveHstPaid;
  const netBusinessIncome = revenueBeforeHst - expensesBeforeHst;
  const estimatedTaxRate = 0.2;
  const estimatedTax = Math.max(0, netBusinessIncome * estimatedTaxRate);
  const netIncome = netBusinessIncome - estimatedTax;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-gradient-to-r from-sky-50 to-indigo-50 px-4 py-3">
        <div className="text-sm text-neutral-800 leading-tight">
          <div className="text-xs uppercase tracking-wide text-neutral-600">
            Year {selectedYear} -{" "}
            {hstRegistered ? "Total received (incl HST)" : "Total received"}
          </div>
          <div className="text-lg font-semibold text-neutral-900">
            {formatCurrency(totalEarnings)}
          </div>
          <div className="text-xs text-neutral-600">
            {hstRegistered && (
              <>
                HST collected {formatCurrency(effectiveHstCollected)} |{" "}
              </>
            )}
            Expenses {formatCurrency(totalExpenses)} |{" "}
            {hstRegistered ? "Cash net (incl HST)" : "Cash net"}{" "}
            <span
              className={
                cashNetInclHst >= 0
                  ? "text-emerald-700 font-semibold"
                  : "text-red-700 font-semibold"
              }
            >
              {formatCurrency(cashNetInclHst)}
            </span>
          </div>
        </div>
        <YearSelector selectedYear={selectedYear} years={years} />
      </div>
      <div className="border-b border-neutral-200 px-4 py-4 text-sm text-neutral-800">
        <div className="text-sm font-semibold text-neutral-900">Financials breakdown</div>
        <div className="mt-3 space-y-2">
          
          {hstRegistered && hstRegistrationDate && (
            <div className="text-[11px] text-neutral-600">
              HST registered since {hstRegistrationDate}
            </div>
          )}
          <details className="rounded border border-neutral-200 bg-white px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-neutral-900">
              <span>{hstRegistered ? "Revenue (before HST)" : "Revenue"}</span>
              <span className="font-semibold">{formatCurrency(revenueBeforeHst)}</span>
            </summary>
            <div className="mt-2 space-y-2 text-xs text-neutral-800">
              {incomeItems.length === 0 ? (
                <div className="text-neutral-600">No income recorded this year.</div>
              ) : (
                <ul className="space-y-1">
                  {incomeItems.map((order) => (
                    <li key={order.id} className="flex items-center justify-between">
                      <span>
                        {new Date(order.createdAt).toLocaleDateString("en-CA")} -{" "}
                        Order {order.id.slice(0, 6)} ({order.status})
                      </span>
                      <span className="font-semibold">{formatCurrency(order.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
          {hstRegistered && (
            <div className="space-y-1 border-b border-neutral-200 pb-2">
              <div className="flex items-center justify-between text-xs text-neutral-700">
                <span>HST collected</span>
                <span>{formatCurrency(effectiveHstCollected)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-700">
                <span>HST paid</span>
                <span>{formatCurrency(effectiveHstPaid)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-900">
                  Net HST owing/refund
                </span>
                <span
                  className={netHst >= 0 ? "font-semibold text-neutral-900" : "font-semibold text-red-700"}
                >
                  {formatCurrency(netHst)}
                </span>
              </div>
            </div>
          )}
          <details className="rounded border border-neutral-200 bg-white px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-neutral-900">
              <span>{hstRegistered ? "Total expenses (before HST)" : "Total expenses"}</span>
              <span className="font-semibold">{formatCurrency(expensesBeforeHst)}</span>
            </summary>
            <div className="mt-2 space-y-2 text-xs text-neutral-800">
              {expenseGroups.length === 0 ? (
                <div className="text-neutral-600">No expenses recorded this year.</div>
              ) : (
                <ul className="space-y-2">
                  {expenseGroups.map((group) => (
                    <li key={group.label} className="space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{group.label}</span>
                        <span>{formatCurrency(group.total)}</span>
                      </div>
                      <ul className="space-y-1 text-[11px] text-neutral-600">
                        {group.items.map((expense, idx) => (
                          <li
                            key={`${expense.date}-${group.label}-${idx}`}
                            className="flex items-start justify-between"
                          >
                            <span>
                              {new Date(expense.date).toLocaleDateString("en-CA")}
                              {expense.details ? ` - ${expense.details}` : ""}
                            </span>
                            <span className="font-medium text-neutral-800">
                              {formatCurrency(expense.amount + (expense.hst ?? 0))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <span>Net business income</span>
            <span
              className={
                netBusinessIncome >= 0
                  ? "font-semibold text-emerald-700"
                  : "font-semibold text-red-700"
              }
            >
              {formatCurrency(netBusinessIncome)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-700">
            <span>Estimated tax (20%)</span>
            <span>{formatCurrency(estimatedTax)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Net income</span>
            <span
              className={
                netIncome >= 0
                  ? "font-semibold text-emerald-700"
                  : "font-semibold text-red-700"
              }
            >
              {formatCurrency(netIncome)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
