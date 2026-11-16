import { json, route } from "@/lib/api";
import { currentUser } from "@/lib/session";

export const GET = route("/api/me", (req) => {
  const user = currentUser(req);
  if (!user) return json({ error: "Not signed in." }, 401);
  return json({ user: { name: user.name, email: user.email } });
});
