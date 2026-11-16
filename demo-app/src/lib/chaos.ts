import { timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { log } from "./log";
import { metrics } from "./metrics";
import { singleton } from "./singleton";

type ChaosState = {
  latencyMs: number;
  errorRate: number;
  transferFailureRate: number;
  leakMbPerSecond: number;
  leakChunks: Buffer[];
  leakTimer: ReturnType<typeof setInterval> | null;
  startedAt: number;
};

const state = singleton<ChaosState>("chaos", () => ({
  latencyMs: 0,
  errorRate: 0,
  transferFailureRate: 0,
  leakMbPerSecond: 0,
  leakChunks: [],
  leakTimer: null,
  startedAt: Date.now(),
}));

const MB = 1024 * 1024;

export function dataDir() {
  return process.env.DATA_DIR || path.join(process.cwd(), ".data");
}

export function crashLoopFlag() {
  return path.join(dataDir(), "crash-loop");
}

/** Chaos is off unless CHAOS_TOKEN is set; callers must send it in x-chaos-token. */
export function checkChaosToken(token: string | null): "ok" | "disabled" | "denied" {
  const expected = process.env.CHAOS_TOKEN;
  if (!expected) return "disabled";
  if (!token) return "denied";
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}

function publish() {
  metrics.chaos.set({ mode: "latency_ms" }, state.latencyMs);
  metrics.chaos.set({ mode: "error_rate" }, state.errorRate);
  metrics.chaos.set({ mode: "transfer_failure_rate" }, state.transferFailureRate);
  metrics.chaos.set({ mode: "leak_mb_per_second" }, state.leakMbPerSecond);
}
publish();

export function chaosStatus() {
  const mem = process.memoryUsage();
  return {
    chaos: {
      latencyMs: state.latencyMs,
      errorRate: state.errorRate,
      transferFailureRate: state.transferFailureRate,
      leakMbPerSecond: state.leakMbPerSecond,
      leakedMb: Math.round(state.leakChunks.reduce((n, c) => n + c.length, 0) / MB),
      crashLoopFlag: existsSync(crashLoopFlag()),
    },
    process: {
      pid: process.pid,
      startedAt: new Date(state.startedAt).toISOString(),
      uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
      rssMb: Math.round(mem.rss / MB),
      heapUsedMb: Math.round(mem.heapUsed / MB),
    },
  };
}

const clamp = (n: unknown, min: number, max: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
};

export function setLatency(ms: unknown) {
  state.latencyMs = Math.round(clamp(ms, 0, 30_000));
  publish();
  log("warn", "chaos_latency", { latency_ms: state.latencyMs });
}

export function setErrorRate(rate: unknown) {
  state.errorRate = clamp(rate, 0, 1);
  publish();
  log("warn", "chaos_error_rate", { error_rate: state.errorRate });
}

export function setTransferFailureRate(rate: unknown) {
  state.transferFailureRate = clamp(rate, 0, 1);
  publish();
  log("warn", "chaos_transfer_failure_rate", { rate: state.transferFailureRate });
}

export function setLeak(mbPerSecond: unknown) {
  const rate = Math.round(clamp(mbPerSecond, 0, 500));
  if (state.leakTimer) clearInterval(state.leakTimer);
  state.leakTimer = null;
  state.leakMbPerSecond = rate;
  if (rate === 0) {
    state.leakChunks = [];
  } else {
    state.leakTimer = setInterval(() => {
      // Filled (not just reserved) so the memory really counts against the container limit.
      state.leakChunks.push(Buffer.alloc(rate * MB, 1));
    }, 1000);
  }
  publish();
  log("warn", "chaos_memory_leak", { mb_per_second: rate });
}

export function resetChaos() {
  state.latencyMs = 0;
  state.errorRate = 0;
  state.transferFailureRate = 0;
  setLeak(0);
  rmSync(crashLoopFlag(), { force: true });
  publish();
  log("info", "chaos_reset");
}

function exitSoon() {
  // Give the HTTP response time to flush before the process dies.
  setTimeout(() => process.exit(1), 300);
}

export function crash() {
  log("fatal", "simulated_crash", {
    message: "Process is exiting with code 1 (crash triggered through the chaos endpoint).",
  });
  exitSoon();
}

export function crashLoop() {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(crashLoopFlag(), `set at ${new Date().toISOString()}\n`);
  log("fatal", "simulated_crash_loop", {
    message:
      "Crash-loop flag written; the app will now fail on every startup until the flag is removed.",
    flag: crashLoopFlag(),
  });
  exitSoon();
}

/** Chaos applied to ordinary API requests. Returns true if the request should fail. */
export async function applyRequestChaos(): Promise<boolean> {
  if (state.latencyMs > 0) await new Promise((r) => setTimeout(r, state.latencyMs));
  return state.errorRate > 0 && Math.random() < state.errorRate;
}

export function transferShouldFail() {
  return state.transferFailureRate > 0 && Math.random() < state.transferFailureRate;
}
