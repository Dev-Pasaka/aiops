"use client";

import Link from "next/link";
import { money } from "@/lib/client";
import { useOverview } from "@/lib/useOverview";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function DashboardPage() {
  const { data, error, reload } = useOverview();
  const total = data?.accounts.reduce((sum, a) => sum + a.balanceCents, 0) ?? 0;

  return (
    <div className="space-y-8">
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
          <span className="size-2.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">We&apos;re having trouble loading your accounts.</span> {error}
            {data && " Showing the last figures we received."}
          </p>
          <button onClick={reload} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100">
            Try again
          </button>
        </div>
      )}

      <section className="relative overflow-hidden rounded-2xl bg-brand-900 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute -right-16 -top-20 size-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-brand-100">Total balance</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              {data ? money(total) : "—"}
            </p>
          </div>
          <Link
            href="/transfer"
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-900 shadow-sm transition hover:bg-brand-50"
          >
            Send money
          </Link>
        </div>
      </section>

      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your accounts
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {data
            ? data.accounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{account.name}</p>
                    <p className="font-mono text-xs text-slate-500">{account.number}</p>
                  </div>
                  <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
                    {money(account.balanceCents)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Available balance</p>
                </div>
              ))
            : [0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
        </div>
      </section>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent activity
        </h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!data ? (
            <div className="h-48 animate-pulse" />
          ) : data.transactions.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.transactions.map((txn) => {
                const failed = txn.status === "failed";
                const incoming = txn.amountCents > 0;
                return (
                  <li key={txn.id} className="flex items-center gap-4 px-5 py-3.5">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                        failed ? "bg-red-50 text-red-700" : incoming ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"
                      }`}
                      aria-hidden="true"
                    >
                      {failed ? "!" : incoming ? "↓" : "↑"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{txn.description}</p>
                      <p className="text-xs text-slate-500">
                        {dateFormat.format(new Date(txn.date))} · {txn.accountName}
                      </p>
                    </div>
                    {failed && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Failed</span>
                    )}
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        failed ? "text-slate-400 line-through" : incoming ? "text-brand-700" : "text-slate-900"
                      }`}
                    >
                      {incoming ? "+" : "−"}
                      {money(Math.abs(txn.amountCents))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
