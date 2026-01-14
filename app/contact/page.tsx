import ContactForm from "@/app/components/ContactForm";

type ContactPageProps = {
  searchParams?: {
    message?: string;
  };
};

export default function ContactPage({ searchParams }: ContactPageProps) {
  const defaultMessage =
    typeof searchParams?.message === "string"
      ? searchParams.message
      : undefined;

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
