import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { singleton } from "./singleton";

export const metrics = singleton("metrics", () => {
  const registry = new Registry();
  registry.setDefaultLabels({ service: "demo-app" });
  collectDefaultMetrics({ register: registry });

  return {
    registry,
    httpRequests: new Counter({
      name: "http_requests_total",
      help: "API requests handled, by route and status code.",
      labelNames: ["method", "route", "status"] as const,
      registers: [registry],
    }),
    httpDuration: new Histogram({
      name: "http_request_duration_seconds",
      help: "API request duration in seconds.",
      labelNames: ["method", "route"] as const,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    }),
    logins: new Counter({
      name: "bank_logins_total",
      help: "Login attempts, by result (success or failed).",
      labelNames: ["result"] as const,
      registers: [registry],
    }),
    transfers: new Counter({
      name: "bank_transfers_total",
      help: "Money transfers, by result (success, rejected or failed).",
      labelNames: ["result"] as const,
      registers: [registry],
    }),
    transferAmount: new Counter({
      name: "bank_transfer_amount_cents_total",
      help: "Total value of successful transfers, in cents.",
      registers: [registry],
    }),
    chaos: new Gauge({
      name: "bank_chaos_setting",
      help: "Current chaos settings (latency_ms, error_rate, transfer_failure_rate, leak_mb_per_second).",
      labelNames: ["mode"] as const,
      registers: [registry],
    }),
  };
});
