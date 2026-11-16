"use client";

import clsx from "clsx";
import { BadgePercent, LogOut, Menu, ScrollText, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { DemoBar } from "@/components/shared/demo-bar";
import { Logo } from "@/components/shared/logo";
import { LoadingBlock } from "@/components/ui/spinner";
import { useClinicUser } from "@/hooks/use-clinic-user";
import { apiFetch } from "@/lib/api-client";

const NAV = [
  { href: "/clinic/patients", label: "Patients", icon: Users, admin: false },
  { href: "/clinic/audit", label: "Audit log", icon: ScrollText, admin: true },
  { href: "/clinic/plan", label: "Clinic plan", icon: BadgePercent, admin: false },
];

/** Clinic dashboard shell (task D7): sidebar, header, role-aware navigation. */
export function ClinicShell({ children }: { children: ReactNode }) {
  const { user, loaded, error } = useClinicUser();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (loaded && !user) router.replace(`/clinic/login?next=${encodeURIComponent(pathname)}`);
  }, [loaded, user, router, pathname]);

  const logout = async () => {
    await apiFetch("/api/auth/logout?area=clinic", { method: "POST" }).catch(() => undefined);
    router.replace("/clinic/login");
  };

  const isAdmin = user?.role === "CLINIC_ADMIN";
  const nav = NAV.filter((n) => !n.admin || isAdmin);

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Clinic">
      <div className="mb-6 px-2">
        <Logo href="/clinic/patients" subtitle="Clinic dashboard" tone="light" />
      </div>
      {nav.map((n) => {
        const active = pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
              active ? "bg-cream-50 text-cocoa-900" : "text-cocoa-200 hover:bg-cocoa-800 hover:text-cream-50",
            )}
          >
            <n.icon className="size-4.5" aria-hidden />
            {n.label}
          </Link>
        );
      })}
      <div className="mt-auto rounded-2xl bg-cocoa-800 p-3">
        {user && (
          <>
            <p className="truncate text-sm font-extrabold text-cream-50">{user.name}</p>
            <p className="truncate text-xs font-semibold text-cocoa-300">
              {user.title ?? (isAdmin ? "Clinic administrator" : "Clinician")} · {user.clinicName}
            </p>
          </>
        )}
        <button
          type="button"
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cocoa-900 py-2 text-sm font-bold text-cream-100 hover:bg-cocoa-950"
        >
          <LogOut className="size-4" aria-hidden /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-cream-50">
      <DemoBar />
      <div className="flex min-h-[calc(100dvh-28px)]">
        <aside className="hidden w-64 shrink-0 bg-cocoa-900 lg:block">
          <div className="sticky top-0 h-[calc(100dvh-28px)]">{sidebar}</div>
        </aside>
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-cocoa-950/40" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 bg-cocoa-900 shadow-lift">{sidebar}</aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-cocoa-100 bg-white/70 px-4 py-3 backdrop-blur lg:hidden">
            <Logo href="/clinic/patients" subtitle="Clinic" />
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="grid size-10 place-items-center rounded-xl ring-1 ring-cocoa-200"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {error ? (
              <div className="py-20 text-center text-sm font-semibold text-missed-ink">
                Can&apos;t reach the Yakap API. Is the Rust server running?
              </div>
            ) : !user ? (
              <LoadingBlock label="Checking your session…" />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-cocoa-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm font-semibold text-cocoa-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}
