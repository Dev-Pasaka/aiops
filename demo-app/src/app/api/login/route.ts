import { clientIp, json, route } from "@/lib/api";
import { log } from "@/lib/log";
import { metrics } from "@/lib/metrics";
import { createSessionCookie } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";

export const POST = route("/api/login", async (req) => {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    metrics.logins.inc({ result: "failed" });
    log("warn", "login_failed", { email: email.slice(0, 80), ip: clientIp(req) });
    return json({ error: "Incorrect email or password." }, 401);
  }

  metrics.logins.inc({ result: "success" });
  log("info", "login_success", { user: user.id, ip: clientIp(req) });

  const secure = req.headers.get("x-forwarded-proto") === "https";
  const res = json({ user: { name: user.name, email: user.email } });
  res.headers.set("set-cookie", createSessionCookie(user.id, secure));
  return res;
});
