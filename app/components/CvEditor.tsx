"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCvEntry,
  deleteCvEntry,
  updateCvEntry,
  type CvEntry,
} from "@/app/actions/cv";

type Props = {
  entries: CvEntry[];
};

type DraftEntry = {
  section: string;
  entry_date: string;
  title: string;
  venue: string;
  location: string;
  details: string;
};

const emptyDraft: DraftEntry = {
  section: "",
  entry_date: "",
  title: "",
  venue: "",
  location: "",
  details: "",
};

const sectionOptions = [
  "Education",
  "Solo Exhibitions",
  "Selected Group Exhibitions",
  "Artist in Residence",
  "Awards and Grants",
  "Press",
  "Collaborative Work",
];

export default function CvEditor({ entries }: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>({});
  const [newEntry, setNewEntry] = useState<DraftEntry>(emptyDraft);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setDrafts(
      entries.reduce((acc, entry) => {
        acc[entry.id] = {
          section: entry.section || "",
          entry_date: entry.entry_date ?? "",
          title: entry.title || "",
          venue: entry.venue ?? "",
          location: entry.location ?? "",
          details: entry.details ?? "",
        };
        return acc;
      }, {} as Record<string, DraftEntry>)
    );
  }, [entries]);

  const grouped = useMemo(() => {
    const map = new Map<string, CvEntry[]>();
    entries.forEach((entry) => {
      const key = entry.section || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    });
    return Array.from(map.entries());
  }, [entries]);

  const updateDraft = (id: string, field: keyof DraftEntry, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSave = async (entryId: string) => {
    const draft = drafts[entryId];
    if (!draft) return;
    setSavingId(entryId);
    setMessage(null);
    try {
      await updateCvEntry({
        entryId,
        section: draft.section,
        entry_date: draft.entry_date || null,
        title: draft.title,
        venue: draft.venue || null,
        location: draft.location || null,
        details: draft.details || null,
      });
      setMessage({ text: "Entry updated.", tone: "success" });
      router.refresh();
    } catch (err) {
      setMessage({ text: (err as Error).message, tone: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Delete this entry?")) return;
    setDeletingId(entryId);
    setMessage(null);
    try {
      await deleteCvEntry(entryId);
      setMessage({ text: "Entry removed.", tone: "success" });
      router.refresh();
    } catch (err) {
      setMessage({ text: (err as Error).message, tone: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async () => {
    if (!newEntry.section.trim() || !newEntry.title.trim()) {
      setMessage({ text: "Section and title are required.", tone: "error" });
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      await createCvEntry({
        section: newEntry.section,
        entry_date: newEntry.entry_date || null,
        title: newEntry.title,
        venue: newEntry.venue || null,
        location: newEntry.location || null,
        details: newEntry.details || null,
      });
      setNewEntry(emptyDraft);
      setMessage({ text: "Entry added.", tone: "success" });
      router.refresh();
    } catch (err) {
      setMessage({ text: (err as Error).message, tone: "error" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Add CV entry</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-neutral-800">
            <span>Section</span>
            <select
              value={newEntry.section}
              onChange={(e) => setNewEntry((prev) => ({ ...prev, section: e.target.value }))}
              className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="">Select a section</option>
              {sectionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-800">
            <span>Date</span>
            <input
              type="date"
              value={newEntry.entry_date}
              onChange={(e) =>
                setNewEntry((prev) => ({ ...prev, entry_date: e.target.value }))
              }
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-800">
            <span>Title</span>
            <input
              value={newEntry.title}
              onChange={(e) => setNewEntry((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Entry title or description"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-800">
            <span>Venue</span>
            <input
              value={newEntry.venue}
              onChange={(e) => setNewEntry((prev) => ({ ...prev, venue: e.target.value }))}
              placeholder="Gallery, festival, institution"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-800">
            <span>Location</span>
            <input
              value={newEntry.location}
              onChange={(e) => setNewEntry((prev) => ({ ...prev, location: e.target.value }))}
              placeholder="City, Province"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-800 lg:col-span-2">
            <span>Details</span>
            <textarea
              value={newEntry.details}
              onChange={(e) => setNewEntry((prev) => ({ ...prev, details: e.target.value }))}
              rows={3}
              placeholder="Extra notes, collaborators, awards, URLs..."
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
          >
            {adding ? "Saving..." : "Add entry"}
          </button>
          {message ? (
            <span
              className={`text-sm ${
                message.tone === "error" ? "text-red-600" : "text-green-700"
              }`}
            >
              {message.text}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Existing entries</h2>
        {grouped.length === 0 ? (
          <p className="text-sm text-neutral-600">No CV entries yet.</p>
        ) : (
          grouped.map(([section, sectionEntries]) => (
            <div key={section} className="space-y-3">
              <div className="text-sm font-semibold text-neutral-900">{section}</div>
              {sectionEntries.map((entry) => {
                const draft = drafts[entry.id];
                if (!draft) return null;
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <div className="grid gap-3 lg:grid-cols-2">
                      <label className="space-y-1 text-sm font-medium text-neutral-800">
                        <span>Section</span>
                        <select
                          value={draft.section}
                          onChange={(e) => updateDraft(entry.id, "section", e.target.value)}
                          className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        >
                          <option value="">Select a section</option>
                          {sectionOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-sm font-medium text-neutral-800">
                        <span>Date</span>
                        <input
                          type="date"
                          value={draft.entry_date}
                          onChange={(e) => updateDraft(entry.id, "entry_date", e.target.value)}
                          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-medium text-neutral-800">
                        <span>Title</span>
                        <input
                          value={draft.title}
                          onChange={(e) => updateDraft(entry.id, "title", e.target.value)}
                          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-medium text-neutral-800">
                        <span>Venue</span>
                        <input
                          value={draft.venue}
                          onChange={(e) => updateDraft(entry.id, "venue", e.target.value)}
                          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-medium text-neutral-800">
                        <span>Location</span>
                        <input
                          value={draft.location}
                          onChange={(e) => updateDraft(entry.id, "location", e.target.value)}
                          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-medium text-neutral-800 lg:col-span-2">
                        <span>Details</span>
                        <textarea
                          value={draft.details}
                          onChange={(e) => updateDraft(entry.id, "details", e.target.value)}
                          rows={3}
                          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSave(entry.id)}
                        disabled={savingId === entry.id}
                        className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                      >
                        {savingId === entry.id ? "Saving..." : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId === entry.id}
                        className="rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        {deletingId === entry.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
