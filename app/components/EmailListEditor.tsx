"use client";

import { useState } from "react";
import { createEmailContact, updateEmailContact, deleteEmailContact, sendEmailToList } from "@/app/actions/emailList";
import type { ContactInput, EmailContact } from "@/lib/emailList";

const fieldClass = "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200";
const primaryClass = "rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50";
const secondaryClass = "rounded border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50";

function ContactForm({ contact, onSave, onCancel }: {
  contact: EmailContact | null;
  onSave: (input: ContactInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ContactInput>({
    first_name: contact?.first_name ?? "", last_name: contact?.last_name ?? "",
    email_address: contact?.email_address ?? "", phone_number: contact?.phone_number ?? "",
    address: contact?.address ?? "", subscribed: contact?.subscribed ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-5" onSubmit={async (event) => {
      event.preventDefault();
      if (saving) return;
      setSaving(true); setError(null);
      try { await onSave(draft); }
      catch (err) { setError(err instanceof Error ? err.message : "Could not save contact."); }
      finally { setSaving(false); }
    }}>
      <h2 className="text-lg font-semibold">{contact ? "Edit contact" : "Add contact"}</h2>
      <p className="text-sm text-neutral-600">Only an email address is required.</p>
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        {([
          ["first_name", "First name", "text", 200], ["last_name", "Last name", "text", 200],
          ["email_address", "Email address (required)", "email", 254], ["phone_number", "Phone number", "tel", 100],
        ] as const).map(([field, label, type, maxLength]) => (
          <label key={field} className="space-y-1 text-sm font-medium">
            <span>{label}</span>
            <input type={type} required={field === "email_address"} maxLength={maxLength} value={draft[field]}
              onChange={(event) => setDraft((prev) => ({ ...prev, [field]: event.target.value }))} className={fieldClass} />
          </label>
        ))}
        <label className="space-y-1 text-sm font-medium sm:col-span-2">
          <span>Address</span>
          <textarea rows={3} maxLength={2000} value={draft.address}
            onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))} className={fieldClass} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input type="checkbox" checked={draft.subscribed} onChange={(event) => setDraft((prev) => ({ ...prev, subscribed: event.target.checked }))} />
          Subscribed to emails
        </label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={primaryClass}>{saving ? "Saving…" : "Save contact"}</button>
        <button type="button" disabled={saving} onClick={onCancel} className={secondaryClass}>Cancel</button>
      </div>
    </form>
  );
}

export default function EmailListEditor({ initialContacts }: { initialContacts: EmailContact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [editing, setEditing] = useState<EmailContact | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const subscribedCount = contacts.filter((contact) => contact.subscribed).length;
  const sortedContacts = [...contacts].sort((a, b) => a.email_address.localeCompare(b.email_address));

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-label="Contacts">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-600">{contacts.length} contacts · {subscribedCount} subscribed</p>
          <button type="button" disabled={editing !== null || deletingId !== null} onClick={() => { setEditing("new"); setNotice(null); setError(null); }} className={primaryClass}>Add contact</button>
        </div>
        {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {editing !== null && (
          <ContactForm key={editing === "new" ? "new" : editing.id} contact={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)} onSave={async (input) => {
              const saved = editing === "new" ? await createEmailContact(input) : await updateEmailContact(editing.id, input);
              setContacts((prev) => editing === "new" ? [...prev, saved] : prev.map((contact) => contact.id === saved.id ? saved : contact));
              setEditing(null); setNotice("Contact saved."); setError(null);
            }} />
        )}
        {contacts.length === 0 ? <p className="text-sm text-neutral-600">No contacts yet. Add an email address to get started.</p> : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {sortedContacts.map((contact) => (
              <li key={contact.id} className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-semibold text-neutral-900">{contact.email_address}</p>
                    <p className="text-sm text-neutral-600">{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "No name provided"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${contact.subscribed ? "bg-green-50 text-green-800" : "bg-neutral-100 text-neutral-600"}`}>
                    {contact.subscribed ? "Subscribed" : "Unsubscribed"}
                  </span>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="font-medium text-neutral-500">Phone</dt><dd>{contact.phone_number || "—"}</dd></div>
                  <div><dt className="font-medium text-neutral-500">Address</dt><dd className="whitespace-pre-line break-words">{contact.address || "—"}</dd></div>
                  <div><dt className="font-medium text-neutral-500">Added</dt><dd>{new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" }).format(new Date(contact.created_at))}</dd></div>
                </dl>
                <div className="flex gap-2">
                  <button type="button" disabled={editing !== null || deletingId !== null} className={secondaryClass}
                    onClick={() => { setEditing(contact); setNotice(null); setError(null); }}>Edit</button>
                  <button type="button" disabled={editing !== null || deletingId !== null} className="rounded border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    onClick={async () => {
                      if (!confirm(`Delete ${contact.email_address} from the email list?`)) return;
                      setDeletingId(contact.id); setError(null); setNotice(null);
                      try {
                        await deleteEmailContact(contact.id);
                        setContacts((prev) => prev.filter((item) => item.id !== contact.id));
                        setNotice("Contact deleted.");
                      } catch (err) { setError(err instanceof Error ? err.message : "Could not delete contact."); }
                      finally { setDeletingId(null); }
                    }}>{deletingId === contact.id ? "Deleting…" : "Delete"}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="space-y-4 rounded-lg border border-neutral-200 p-5 sm:p-6" onSubmit={async (event) => {
        event.preventDefault();
        if (sending) return;
        setSending(true); setSendResult(null); setSendError(null);
        try {
          const result = await sendEmailToList({ subject, body });
          setSendResult(result.total === 0 ? "No emails sent: there are no subscribed contacts."
            : `Emails sent: ${result.sent}. Failed: ${result.failed}.${result.failed && result.sent ? " Sending again will also resend to contacts who already received this email." : ""}`);
          if (result.total > 0 && result.failed === 0) { setSubject(""); setBody(""); }
        } catch (err) { setSendError(err instanceof Error ? err.message : "Could not send email."); }
        finally { setSending(false); }
      }}>
        <h2 className="text-lg font-semibold">Send an email</h2>
        <p className="text-sm text-neutral-600">Send a separate email to each subscribed contact. A first name is used in the greeting when available.</p>
        <fieldset disabled={sending} className="space-y-4">
          <label className="block space-y-1 text-sm font-medium">
            <span>Subject</span>
            <input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} className={fieldClass} />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            <span>Message</span>
            <textarea required rows={8} maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)} className={fieldClass} />
          </label>
        </fieldset>
        {sendResult && <p role="status" className="text-sm text-neutral-700">{sendResult}</p>}
        {sendError && <p role="alert" className="text-sm text-red-700">{sendError}</p>}
        <button type="submit" disabled={sending || subscribedCount === 0} className={primaryClass}>
          {sending ? "Sending…" : `Send to ${subscribedCount} subscribed contact${subscribedCount === 1 ? "" : "s"}`}
        </button>
      </form>
    </div>
  );
}
