"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getSessionAction } from "@/app/actions/session";

type SessionState = {
  loading: boolean;
  loggedIn: boolean;
  firstName?: string;
};

async function fetchSession(): Promise<SessionState> {
  try {
    const data = await getSessionAction();
    return {
      loading: false,
      loggedIn: Boolean(data?.loggedIn),
      firstName: (data as any)?.user?.firstName,
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        !target ||
        mobileMenuRef.current?.contains(target) ||
        mobileToggleRef.current?.contains(target)
      ) {
        return;
      }
      setMobileOpen(false);
    };

    window.addEventListener("click", handleClickAway);
    return () => window.removeEventListener("click", handleClickAway);
  }, [mobileOpen]);

  const handleSignOut = async () => {
    try {
      await logoutAction();
    } finally {
      setSession({ loading: false, loggedIn: false });
      startTransition(() => {
        router.push("/");
        router.refresh();
      });
    }
  };

  const isLoggedIn = session.loggedIn;

  const renderNavLinks = (isMobile = false) => {
    if (isLoggedIn) {
      return (
        <>
          <Link
            href="/app/dashboard/gallery"
            className="block transition hover:text-neutral-600"
          >
            Manage gallery
          </Link>
          <Link
            href="/app/dashboard/inventory"
            className="block transition hover:text-neutral-600"
          >
            Manage prints
          </Link>
          <Link
            href="/app/dashboard/finances"
            className="block transition hover:text-neutral-600"
          >
            Manage finances
          </Link>
          <Link
            href="/app/dashboard/orders"
            className="block transition hover:text-neutral-600"
          >
            Orders
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
            className={`${
              isMobile ? "w-full" : "mt-2 w-full"
            } rounded bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700`}
            disabled={session.loading || isPending}
          >
            Sign out
          </button>
        </>
      );
    }

    return (
      <>
        <Link href="/about" className="block transition hover:text-neutral-600">
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
        <Link
          href="/prints"
          className="block transition hover:text-neutral-600"
        >
          Prints
        </Link>
        <Link
          href="/contact"
          className="block transition hover:text-neutral-600"
        >
          Contact
        </Link>
      </>
    );
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 w-full bg-white/95 px-4 py-3 shadow-none backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <Link
            href={isLoggedIn ? "/app/dashboard" : "/"}
            className="group block text-neutral-900 transition hover:text-neutral-700"
          >
            <div className="text-2xl font-semibold tracking-tight">
              Eric Fong
            </div>
            <div className="text-base font-semibold leading-tight">方仁健</div>
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
            ref={mobileToggleRef}
            className="rounded border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
          >
            ☰
          </button>
        </div>
        {mobileOpen && (
          <div
            ref={mobileMenuRef}
            className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 shadow-sm"
          >
            {renderNavLinks(true)}
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-40 shrink-0 bg-white/90 px-5 py-12 text-left lg:block">
        <Link
          href={isLoggedIn ? "/app/dashboard" : "/"}
          className="group block whitespace-nowrap text-neutral-900 transition hover:text-neutral-700"
        >
          <div className="text-3xl font-semibold tracking-tight">Eric Fong</div>
          <div className="mt-1 text-lg font-semibold">方仁健</div>
        </Link>
        <nav className="mt-6 space-y-3 text-sm font-medium text-neutral-800">
          {renderNavLinks()}
        </nav>
      </aside>
    </>
  );
}
