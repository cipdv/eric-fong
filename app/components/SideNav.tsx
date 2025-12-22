"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type SessionState = {
  loading: boolean;
  loggedIn: boolean;
  firstName?: string;
};

async function fetchSession(): Promise<SessionState> {
  try {
    const res = await fetch("/api/session", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Failed");
    }
    const data = await res.json();
    return {
      loading: false,
      loggedIn: Boolean(data?.loggedIn),
      firstName: data?.user?.firstName,
    };
  } catch {
    return { loading: false, loggedIn: false };
  }
}

export function SideNav() {
  const [session, setSession] = useState<SessionState>({
    loading: true,
    loggedIn: false,
  });
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const load = async () => {
      const nextSession = await fetchSession();
      if (active) setSession(nextSession);
    };
    load();

    const handleFocus = () => load();
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      setSession({ loading: false, loggedIn: false });
      router.push("/");
      router.refresh();
    }
  };

  const isLoggedIn = session.loggedIn;

  return (
    <aside className="sticky top-0 h-screen w-40 shrink-0 bg-white/90 px-5 py-12 text-left">
      <Link
        href={isLoggedIn ? "/app/dashboard" : "/"}
        className="group block whitespace-nowrap text-neutral-900 transition hover:text-neutral-700"
      >
        <div className="text-3xl font-semibold tracking-tight">Eric Fong</div>
        <div className="mt-1 text-lg font-semibold">方仁健</div>
      </Link>
      <nav className="mt-6 space-y-3 text-sm font-medium text-neutral-800">
        {isLoggedIn ? (
          <>
            <Link
              href="/app/dashboard/gallery"
              className="block transition hover:text-neutral-600"
            >
              Manage gallery
            </Link>
            <Link
              href="/app/dashboard/records"
              className="block transition hover:text-neutral-600"
            >
              Manage records
            </Link>
            <Link
              href="/app/dashboard/cv"
              className="block transition hover:text-neutral-600"
            >
              Edit CV
            </Link>
            <Link
              href="/app/dashboard/profile"
              className="block transition hover:text-neutral-600"
            >
              Edit profile
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-2 w-full rounded bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
              disabled={session.loading}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              href="/about"
              className="block transition hover:text-neutral-600"
            >
              About
            </Link>
            <Link href="/cv" className="block transition hover:text-neutral-600">
              CV
            </Link>
            <Link
              href="/gallery"
              className="block transition hover:text-neutral-600"
            >
              Gallery
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}
