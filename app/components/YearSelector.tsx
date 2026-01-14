"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  selectedYear: number;
  years: number[];
};

export default function YearSelector({ selectedYear, years }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const year = event.target.value;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (year) params.set("year", year);
    router.replace(`?${params.toString()}`);
  };

  return (
    <label className="inline-flex items-center gap-2 text-sm text-neutral-800">
      Year
      <select
        value={selectedYear}
        onChange={handleChange}
        className="rounded border border-neutral-300 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}
