import { json, route } from "@/lib/api";
import { clearSessionCookie } from "@/lib/session";

export const POST = route("/api/logout", () => {
  const res = json({ ok: true });
  res.headers.set("set-cookie", clearSessionCookie());
  return res;
});
