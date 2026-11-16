import type { NextRequest } from "next/server";
import { applyRequestChaos } from "./chaos";
import { log } from "./log";
import { metrics } from "./metrics";

type Handler = (req: NextRequest) => Promise<Response> | Response;

type Options = {
  /** Set false for operational endpoints (health, metrics, chaos) that chaos must not break. */
  chaos?: boolean;
  /** Set false to keep noisy endpoints (health, metrics) out of the request log. */
  accessLog?: boolean;
};

export function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Wraps every API route: applies chaos (latency, injected errors), records
 * Prometheus metrics, and writes one structured log line per request.
 */
export function route(name: string, handler: Handler, options: Options = {}) {
  const { chaos = true, accessLog = true } = options;

  return async (req: NextRequest): Promise<Response> => {
    const started = performance.now();
    let status = 500;
    try {
      if (chaos && (await applyRequestChaos())) {
        log("error", "request_failed", {
          route: name,
          message: "Injected failure: upstream ledger service unavailable (chaos error rate).",
        });
        return json({ error: "Something went wrong on our side. Please try again." }, 500);
      }
      const res = await handler(req);
      status = res.status;
      return res;
    } catch (err) {
      log("error", "unhandled_error", {
        route: name,
        message: err instanceof Error ? err.message : String(err),
      });
      return json({ error: "Something went wrong on our side. Please try again." }, 500);
    } finally {
      const seconds = (performance.now() - started) / 1000;
      metrics.httpRequests.inc({ method: req.method, route: name, status: String(status) });
      metrics.httpDuration.observe({ method: req.method, route: name }, seconds);
      if (accessLog) {
        log(status >= 500 ? "error" : "info", "request", {
          method: req.method,
          route: name,
          status,
          duration_ms: Math.round(seconds * 1000),
          ip: clientIp(req),
        });
      }
    }
  };
}
