import { json, route } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { accountsFor, payeesFor, transactionsFor } from "@/lib/store";

export const GET = route("/api/accounts", (req) => {
  const user = currentUser(req);
  if (!user) return json({ error: "Not signed in." }, 401);

  const accounts = accountsFor(user.id);
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  return json({
    accounts: accounts.map(({ id, name, number, balanceCents }) => ({ id, name, number, balanceCents })),
    transactions: transactionsFor(user.id).map((t) => ({ ...t, accountName: names.get(t.accountId) })),
    payees: payeesFor(user.id).map(({ id, name, detail }) => ({ id, name, detail })),
  });
});
