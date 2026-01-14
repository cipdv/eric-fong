import ContactForm from "@/app/components/ContactForm";

type ContactPageProps = {
  searchParams?: Promise<{
    message?: string;
  }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const defaultMessage =
    typeof resolved?.message === "string" ? resolved.message : undefined;

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900">Contact</h1>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <ContactForm initialMessage={defaultMessage} />
      </div>
    </div>
  );
}
