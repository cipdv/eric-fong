import { sql } from "@vercel/postgres";

type CvEntry = {
  id: string;
  section: string;
  entry_date: string | null;
  title: string;
  venue: string | null;
  location: string | null;
  details: string | null;
};

async function getCvEntries(): Promise<CvEntry[]> {
  const { rows } = await sql<CvEntry>`
    SELECT
      id,
      section,
      to_char(entry_date, 'Mon YYYY') AS entry_date,
      title,
      venue,
      location,
      details
    FROM cv_entries
    ORDER BY
      section ASC,
      entry_date DESC NULLS LAST,
      title ASC;
  `;
  return rows.map((row) => ({
    id: String(row.id),
    section: row.section,
    entry_date: row.entry_date ?? null,
    title: row.title,
    venue: row.venue ?? null,
    location: row.location ?? null,
    details: row.details ?? null,
  }));
}

export default async function CvPage() {
  const entries = await getCvEntries();

  if (!entries.length) {
    return (
      <div className="space-y-3 pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900">CV</h1>
        <p className="text-sm text-neutral-600">No CV entries yet.</p>
      </div>
    );
  }

  const grouped = entries.reduce<Record<string, CvEntry[]>>((acc, entry) => {
    const key = entry.section || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-8 pb-12">
      <h1 className="text-2xl font-semibold text-neutral-900">CV</h1>
      {Object.entries(grouped).map(([section, sectionEntries]) => (
        <section key={section} className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">{section}</h2>
          <div className="space-y-3">
            {sectionEntries.map((entry) => (
              <div key={entry.id} className="grid gap-2 sm:grid-cols-[140px_1fr]">
                <div className="text-sm font-semibold text-neutral-700">
                  {entry.entry_date || ""}
                </div>
                <div className="space-y-1 text-sm text-neutral-800">
                  <div className="font-semibold text-neutral-900">{entry.title}</div>
                  {entry.venue || entry.location ? (
                    <div className="text-neutral-700">
                      {[entry.venue, entry.location].filter(Boolean).join(", ")}
                    </div>
                  ) : null}
                  {entry.details ? (
                    <div className="whitespace-pre-line text-neutral-700">{entry.details}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
