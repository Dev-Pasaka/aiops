"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Logo } from "./Logo";

const NAV = [
  { href: "/dashboard", label: "Accounts" },
  { href: "/transfer", label: "Send money" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ user: { name: string } }>("/api/me")
      .then((d) => alive && setName(d.user.name))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function signOut() {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  const initials = name
    ?.split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-4 sm:gap-8 sm:px-6">
          <Link href="/dashboard" aria-label="Demo Bank home">
            <Logo />
          </Link>
          <nav className="flex gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {name && (
              <>
                <span className="grid size-9 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {initials}
                </span>
                <span className="hidden text-sm font-medium text-slate-700 sm:block">{name}</span>
              </>
            )}
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500">
        Demo Bank is fictional. No real money, accounts or people.
      </footer>
    </div>
  );
}
