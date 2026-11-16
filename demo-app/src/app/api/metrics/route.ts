import { route } from "@/lib/api";
import { metrics } from "@/lib/metrics";

export const GET = route(
  "/api/metrics",
  async () =>
    new Response(await metrics.registry.metrics(), {
      headers: { "content-type": metrics.registry.contentType, "cache-control": "no-store" },
    }),
  { chaos: false, accessLog: false },
);
