import Link from "next/link";

export function SideNav() {
  return (
    <aside className="sticky top-0 h-screen w-40 shrink-0 bg-white/90 px-5 py-12 text-left">
      <Link
        href="/"
        className="text-2xl font-semibold tracking-tight text-neutral-900 transition hover:text-neutral-700"
      >
        Eric Fong
      </Link>
      <nav className="mt-6 space-y-3 text-sm font-medium text-neutral-800">
        <Link href="/about" className="block transition hover:text-neutral-600">
          About
        </Link>
        <Link href="/cv" className="block transition hover:text-neutral-600">
          CV
        </Link>
        <Link href="/gallery" className="block transition hover:text-neutral-600">
          Gallery
        </Link>
      </nav>
    </aside>
  );
}
