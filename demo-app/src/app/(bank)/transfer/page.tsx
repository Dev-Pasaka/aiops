"use client";

import Link from "next/link";
import { useState } from "react";
import { api, money } from "@/lib/client";
import { useOverview } from "@/lib/useOverview";

type Result = { kind: "success" | "error"; message: string };

const field =
  "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100";

export default function TransferPage() {
  const { data, error: loadError, reload } = useOverview(15000);
  const [fromAccountId, setFromAccountId] = useState("");
  const [payeeId, setPayeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const from = fromAccountId || data?.accounts[0]?.id || "";
  const payee = payeeId || data?.payees[0]?.id || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await api("/api/transfer", {
        method: "POST",
        body: JSON.stringify({ fromAccountId: from, payeeId: payee, amount: Number(amount), note }),
      });
      const payeeName = data?.payees.find((p) => p.id === payee)?.name ?? "your payee";
      setResult({ kind: "success", message: `${money(Math.round(Number(amount) * 100))} sent to ${payeeName}.` });
      setAmount("");
      setNote("");
    } catch (err) {
      setResult({ kind: "error", message: err instanceof Error ? err.message : "Transfer failed." });
    } finally {
      setBusy(false);
      reload();
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Send money</h1>
      <p className="mt-1 text-sm text-slate-600">Pay another Demo Bank customer or a biller.</p>

      {loadError && !data && (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-semibold">We can&apos;t load your accounts right now.</span> {loadError}
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="from" className="block text-sm font-medium text-slate-700">
            From
          </label>
          <select id="from" value={from} onChange={(e) => setFromAccountId(e.target.value)} className={field} disabled={!data}>
            {data?.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.number} — {money(a.balanceCents)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="payee" className="block text-sm font-medium text-slate-700">
            To
          </label>
          <select id="payee" value={payee} onChange={(e) => setPayeeId(e.target.value)} className={field} disabled={!data}>
            {data?.payees.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.detail}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
            Amount (USD)
          </label>
          <input
            id="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${field} text-lg font-semibold tabular-nums`}
          />
        </div>

        <div>
          <label htmlFor="note" className="block text-sm font-medium text-slate-700">
            Reference <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input id="note" type="text" maxLength={60} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
        </div>

        {result && (
          <p
            role={result.kind === "error" ? "alert" : "status"}
            className={`rounded-lg border px-3.5 py-2.5 text-sm ${
              result.kind === "success"
                ? "border-brand-100 bg-brand-50 text-brand-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <span className="font-semibold">{result.kind === "success" ? "Transfer complete. " : "Transfer failed. "}</span>
            {result.message}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={busy || !data}
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send money"}
          </button>
          <Link href="/dashboard" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to accounts
          </Link>
        </div>
      </form>
    </div>
  );
}
