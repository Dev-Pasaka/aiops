import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { singleton } from "./singleton";
import { findUserById, type User } from "./store";

export const SESSION_COOKIE = "bank_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

// Signed, stateless cookie: sessions survive an app restart, which matters for the demo.
const secret = () =>
  process.env.SESSION_SECRET || singleton("session_secret", () => randomBytes(32).toString("hex"));

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionCookie(userId: string, secure: boolean) {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function currentUser(req: NextRequest): User | null {
  const value = req.cookies.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || exp < Date.now()) return null;
    return findUserById(String(u));
  } catch {
    return null;
  }
}
