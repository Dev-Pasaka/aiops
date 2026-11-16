"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  chaos: {
    latencyMs: number;
    errorRate: number;
    transferFailureRate: number;
    leakMbPerSecond: number;
    leakedMb: number;
    crashLoopFlag: boolean;
  };
  process: { pid: number; startedAt: string; uptimeSeconds: number; rssMb: number; heapUsedMb: number };
};

type Health = "up" | "down" | "locked" | "unknown";

const TOKEN_KEY = "demobank-chaos-token";

function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function uptime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function ChaosPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [health, setHealth] = useState<Health>("unknown");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (current: string) => {
    try {
      const res = await fetch("/api/chaos", { headers: { "x-chaos-token": current }, cache: "no-store" });
      if (res.ok) {
        setStatus(await res.json());
        setHealth("up");
      } else if (res.status === 403 || res.status === 503) {
        // The app answered, so it is up; we just are not allowed in (or chaos is disabled).
        setHealth("locked");
        setStatus(null);
        if (res.status === 503) setMessage("Chaos is disabled on the server: CHAOS_TOKEN is not set.");
      } else {
        setHealth("down");
      }
    } catch {
      setHealth("down");
    }
  }, []);

  useEffect(() => {
    const saved = readToken();
    const first = setTimeout(() => {
      setToken(saved);
      refresh(saved);
    }, 0);
    return () => clearTimeout(first);
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => refresh(token), 2000);
    return () => clearInterval(timer);
  }, [refresh, token]);

  function saveToken(value: string) {
    setToken(value);
    setMessage(null);
    try {
      window.localStorage.setItem(TOKEN_KEY, value);
    } catch {
      // Private windows may block storage; the token still works for this visit.
    }
    refresh(value);
  }

  async function act(label: string, body: Record<string, unknown>) {
    setMessage(null);
    try {
      const res = await fetch("/api/chaos", {
        method: "POST",
        headers: { "content-type": "application/json", "x-chaos-token": token },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      setMessage(res.ok ? `${label}: done.` : `${label} failed: ${data?.error ?? `HTTP ${res.status}`}`);
    } catch {
      setMessage(`${label} failed: the app did not respond.`);
    }
    refresh(token);
  }

  const c = status?.chaos;
  const locked = health !== "up";

  const banner = {
    up: { text: "App is up", tone: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", dot: "bg-emerald-400" },
    down: { text: "App is not responding", tone: "bg-red-500/15 text-red-300 ring-red-500/40", dot: "bg-red-400" },
    locked: { text: "App is up — enter the chaos token", tone: "bg-amber-500/15 text-amber-200 ring-amber-500/30", dot: "bg-amber-400" },
    unknown: { text: "Checking…", tone: "bg-slate-500/15 text-slate-300 ring-slate-500/30", dot: "bg-slate-400" },
  }[health];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ colorScheme: "dark" }}>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">Demo Bank</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Chaos control panel</h1>
            <p className="mt-2 max-w-xl text-slate-400">Break the bank on purpose, then watch the AIOps stack detect and fix it.</p>
          </div>
          <div role="status" className={`inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-base font-semibold ring-1 ${banner.tone}`}>
            <span className={`size-2.5 rounded-full ${banner.dot} ${health === "down" ? "animate-pulse" : ""}`} aria-hidden="true" />
            {banner.text}
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <label htmlFor="token" className="block text-sm font-medium text-slate-300">
            Chaos token
          </label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => saveToken(e.target.value)}
            placeholder="Value of CHAOS_TOKEN"
            className="mt-1.5 block w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-slate-100 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
          />
          <p className="mt-2 text-xs text-slate-500">Kept in this browser only. Every chaos request must carry it.</p>
        </section>

        <section aria-label="Current state" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Added latency" value={c ? `${c.latencyMs} ms` : "—"} active={!!c && c.latencyMs > 0} />
          <Tile label="Error rate" value={c ? `${Math.round(c.errorRate * 100)}%` : "—"} active={!!c && c.errorRate > 0} />
          <Tile label="Transfer failures" value={c ? `${Math.round(c.transferFailureRate * 100)}%` : "—"} active={!!c && c.transferFailureRate > 0} />
          <Tile label="Memory leaked" value={c ? `${c.leakedMb} MB` : "—"} active={!!c && c.leakMbPerSecond > 0} />
          <Tile label="Memory in use" value={status ? `${status.process.rssMb} MB` : "—"} />
          <Tile label="Uptime" value={status ? uptime(status.process.uptimeSeconds) : "—"} />
          <Tile label="Process ID" value={status ? String(status.process.pid) : "—"} />
          <Tile label="Crash-loop flag" value={c ? (c.crashLoopFlag ? "Set" : "Clear") : "—"} active={!!c?.crashLoopFlag} />
        </section>

        {message && (
          <p role="status" className="mt-6 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
            {message}
          </p>
        )}

        <section aria-label="Actions" className="mt-6 grid gap-4 md:grid-cols-2">
          <Card title="Crash the app" text="The process exits once. Act 1: the agent should restart it.">
            <Btn danger disabled={locked} onClick={() => act("Crash", { action: "crash" })}>
              Crash now
            </Btn>
          </Card>
          <Card title="Crash loop" text="The app exits and then fails on every startup. Act 1: three restarts, then escalation. Only reset.sh clears it.">
            <Btn danger disabled={locked} onClick={() => act("Crash loop", { action: "crash-loop" })}>
              Start crash loop
            </Btn>
          </Card>
          <Card title="Latency" text="Adds a delay to every banking request. Act 2: latency alert.">
            <Btn disabled={locked} onClick={() => act("Latency 500 ms", { action: "latency", ms: 500 })}>
              500 ms
            </Btn>
            <Btn disabled={locked} onClick={() => act("Latency 2 s", { action: "latency", ms: 2000 })}>
              2 s
            </Btn>
            <Btn quiet disabled={locked} onClick={() => act("Latency off", { action: "latency", ms: 0 })}>
              Off
            </Btn>
          </Card>
          <Card title="Errors" text="A share of banking requests return HTTP 500. Act 2: error-rate alert.">
            <Btn disabled={locked} onClick={() => act("Errors 20%", { action: "errors", rate: 0.2 })}>
              20%
            </Btn>
            <Btn disabled={locked} onClick={() => act("Errors 60%", { action: "errors", rate: 0.6 })}>
              60%
            </Btn>
            <Btn quiet disabled={locked} onClick={() => act("Errors off", { action: "errors", rate: 0 })}>
              Off
            </Btn>
          </Card>
          <Card title="Failed transfers" text="The payment gateway times out, so transfers fail while the rest of the app works.">
            <Btn disabled={locked} onClick={() => act("Transfer failures 50%", { action: "transfer-failures", rate: 0.5 })}>
              50%
            </Btn>
            <Btn disabled={locked} onClick={() => act("Transfer failures 100%", { action: "transfer-failures", rate: 1 })}>
              100%
            </Btn>
            <Btn quiet disabled={locked} onClick={() => act("Transfer failures off", { action: "transfer-failures", rate: 0 })}>
              Off
            </Btn>
          </Card>
          <Card title="Memory leak" text="Memory grows every second until the container is killed for running out.">
            <Btn disabled={locked} onClick={() => act("Leak 20 MB/s", { action: "leak", mbPerSecond: 20 })}>
              20 MB/s
            </Btn>
            <Btn quiet disabled={locked} onClick={() => act("Leak stopped", { action: "leak", mbPerSecond: 0 })}>
              Stop and free
            </Btn>
          </Card>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Reset everything</h2>
            <p className="mt-1 text-sm text-slate-400">Turns off latency, errors, transfer failures and the leak, and clears the crash-loop flag.</p>
          </div>
          <button
            disabled={locked}
            onClick={() => act("Reset", { action: "reset" })}
            className="rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset all
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${active ? "border-amber-400/60 bg-amber-400/10" : "border-slate-800 bg-slate-900"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${active ? "text-amber-300" : "text-slate-100"}`}>{value}</p>
    </div>
  );
}

function Card({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-slate-400">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  danger = false,
  quiet = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  quiet?: boolean;
}) {
  const tone = danger
    ? "bg-red-500 text-white hover:bg-red-400"
    : quiet
      ? "border border-slate-700 text-slate-300 hover:bg-slate-800"
      : "bg-amber-400 text-amber-950 hover:bg-amber-300";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}
    >
      {children}
    </button>
  );
}
