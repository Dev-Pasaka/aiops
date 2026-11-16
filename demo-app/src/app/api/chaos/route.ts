import type { NextRequest } from "next/server";
import { clientIp, json, route } from "@/lib/api";
import {
  chaosStatus,
  checkChaosToken,
  crash,
  crashLoop,
  resetChaos,
  setErrorRate,
  setLatency,
  setLeak,
  setTransferFailureRate,
} from "@/lib/chaos";
import { log } from "@/lib/log";

function guard(req: NextRequest) {
  const check = checkChaosToken(req.headers.get("x-chaos-token"));
  if (check === "disabled") return json({ error: "Chaos is disabled (CHAOS_TOKEN is not set)." }, 503);
  if (check === "denied") {
    log("warn", "chaos_denied", { ip: clientIp(req) });
    return json({ error: "Invalid chaos token." }, 403);
  }
  return null;
}

export const GET = route("/api/chaos", (req) => guard(req) ?? json(chaosStatus()), {
  chaos: false,
  accessLog: false,
});

export const POST = route(
  "/api/chaos",
  async (req) => {
    const denied = guard(req);
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");
    log("warn", "chaos_action", { action, ip: clientIp(req) });

    switch (action) {
      case "crash":
        crash();
        return json({ ok: true, message: "Crashing now." });
      case "crash-loop":
        crashLoop();
        return json({ ok: true, message: "Crashing now; every restart will fail until reset." });
      case "latency":
        setLatency(body?.ms);
        break;
      case "errors":
        setErrorRate(body?.rate);
        break;
      case "transfer-failures":
        setTransferFailureRate(body?.rate);
        break;
      case "leak":
        setLeak(body?.mbPerSecond);
        break;
      case "reset":
        resetChaos();
        break;
      default:
        return json(
          { error: "Unknown action. Use crash, crash-loop, latency, errors, transfer-failures, leak or reset." },
          400,
        );
    }
    return json({ ok: true, ...chaosStatus() });
  },
  { chaos: false },
);
