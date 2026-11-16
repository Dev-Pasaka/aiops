import { json, route } from "@/lib/api";

export const GET = route("/api/health", () => json({ status: "ok" }), {
  chaos: false,
  accessLog: false,
});
