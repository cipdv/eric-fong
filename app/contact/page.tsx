export default function ContactPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Contact</h1>
        <p className="text-sm text-neutral-700">
          Get in touch about purchasing an original or print.
        </p>
      </div>
      <form className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-800">
              First name
            </label>
            <input
              type="text"
              name="firstName"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-800">
              Last name
            </label>
            <input
              type="text"
              name="lastName"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-neutral-800">
            Phone number
          </label>
          <input
            type="tel"
            name="phone"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-neutral-800">
            Email address
          </label>
          <input
            type="email"
            name="email"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>
        <button
          type="button"
          className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
