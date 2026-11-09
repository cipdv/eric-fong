import type { Metadata } from "next";
import { getEmailContacts } from "@/app/actions/emailList";
import EmailListEditor from "@/app/components/EmailListEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email list", robots: { index: false, follow: false } };

export default async function EmailListPage() {
  const contacts = await getEmailContacts();
  return (
    <div className="mt-8 min-w-0 space-y-6 pb-12">
      <h1 className="text-2xl font-semibold text-neutral-900">Email list</h1>
      <EmailListEditor initialContacts={contacts} />
    </div>
  );
}
