import { singleton } from "./singleton";

// In-memory bank. All data is fake and resets when the app restarts.

export type User = { id: string; email: string; name: string; password: string };
export type Account = {
  id: string;
  userId: string;
  name: string;
  number: string;
  balanceCents: number;
};
export type Transaction = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amountCents: number;
  status: "completed" | "failed";
};
export type Payee = { id: string; name: string; detail: string; accountId?: string };

type Store = {
  users: User[];
  accounts: Account[];
  transactions: Transaction[];
  externalPayees: Payee[];
  nextTxn: number;
};

const DEMO_PASSWORD = "demo1234";

function seed(): Store {
  const users: User[] = [
    { id: "u1", email: "amina@demobank.test", name: "Amina Otieno", password: DEMO_PASSWORD },
    { id: "u2", email: "brian@demobank.test", name: "Brian Keller", password: DEMO_PASSWORD },
    { id: "u3", email: "chloe@demobank.test", name: "Chloe Martin", password: DEMO_PASSWORD },
  ];

  const accounts: Account[] = [
    { id: "a1", userId: "u1", name: "Everyday Current", number: "•••• 4821", balanceCents: 482_650 },
    { id: "a2", userId: "u1", name: "Rainy Day Savings", number: "•••• 9073", balanceCents: 1_250_000 },
    { id: "a3", userId: "u2", name: "Everyday Current", number: "•••• 1134", balanceCents: 219_480 },
    { id: "a4", userId: "u2", name: "Holiday Savings", number: "•••• 5560", balanceCents: 640_000 },
    { id: "a5", userId: "u3", name: "Everyday Current", number: "•••• 7702", balanceCents: 731_915 },
    { id: "a6", userId: "u3", name: "House Deposit", number: "•••• 3348", balanceCents: 3_875_000 },
  ];

  const externalPayees: Payee[] = [
    { id: "p-power", name: "City Power & Light", detail: "Utility bill" },
    { id: "p-rent", name: "Greenfield Apartments", detail: "Rent" },
    { id: "p-net", name: "FibreLink Internet", detail: "Broadband" },
  ];

  const history: [string, number][] = [
    ["Salary — Acme Analytics", 385_000],
    ["Greenfield Apartments", -120_000],
    ["Fresh Basket Supermarket", -8_435],
    ["City Power & Light", -6_210],
    ["Coffee Corner", -480],
    ["FibreLink Internet", -4_500],
    ["Refund — BookNook", 2_199],
  ];

  let nextTxn = 1;
  const transactions: Transaction[] = [];
  const hour = 60 * 60 * 1000;
  for (const account of accounts.filter((a) => a.name === "Everyday Current")) {
    history.forEach(([description, amountCents], i) => {
      transactions.push({
        id: `t${nextTxn++}`,
        accountId: account.id,
        date: new Date(Date.now() - (i * 19 + 3) * hour).toISOString(),
        description,
        amountCents,
        status: "completed",
      });
    });
  }

  return { users, accounts, transactions, externalPayees, nextTxn };
}

const store = singleton("store", seed);

export const findUserByEmail = (email: string) =>
  store.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ?? null;

export const findUserById = (id: string) => store.users.find((u) => u.id === id) ?? null;

export const accountsFor = (userId: string) => store.accounts.filter((a) => a.userId === userId);

export function transactionsFor(userId: string, limit = 12) {
  const ids = new Set(accountsFor(userId).map((a) => a.id));
  return store.transactions
    .filter((t) => ids.has(t.accountId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/** Other customers' current accounts plus a few external billers. */
export function payeesFor(userId: string): Payee[] {
  const people = store.users
    .filter((u) => u.id !== userId)
    .map((u) => {
      const account = store.accounts.find((a) => a.userId === u.id)!;
      return { id: `p-${u.id}`, name: u.name, detail: `Demo Bank ${account.number}`, accountId: account.id };
    });
  return [...people, ...store.externalPayees];
}

function record(accountId: string, description: string, amountCents: number, status: Transaction["status"]) {
  store.transactions.push({
    id: `t${store.nextTxn++}`,
    accountId,
    date: new Date().toISOString(),
    description,
    amountCents,
    status,
  });
}

export type TransferResult =
  | { ok: true; newBalanceCents: number }
  | { ok: false; reason: "account_not_found" | "payee_not_found" | "invalid_amount" | "insufficient_funds" };

export function transfer(
  userId: string,
  fromAccountId: string,
  payeeId: string,
  amountCents: number,
  note: string,
): TransferResult {
  const from = accountsFor(userId).find((a) => a.id === fromAccountId);
  if (!from) return { ok: false, reason: "account_not_found" };
  const payee = payeesFor(userId).find((p) => p.id === payeeId);
  if (!payee) return { ok: false, reason: "payee_not_found" };
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 10_000_000) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (from.balanceCents < amountCents) return { ok: false, reason: "insufficient_funds" };

  const suffix = note ? ` — ${note}` : "";
  from.balanceCents -= amountCents;
  record(from.id, `Transfer to ${payee.name}${suffix}`, -amountCents, "completed");

  const to = payee.accountId ? store.accounts.find((a) => a.id === payee.accountId) : undefined;
  if (to) {
    const sender = findUserById(userId)?.name ?? "Demo Bank customer";
    to.balanceCents += amountCents;
    record(to.id, `Transfer from ${sender}${suffix}`, amountCents, "completed");
  }
  return { ok: true, newBalanceCents: from.balanceCents };
}

/** Shown in the customer's history when the payment gateway fails mid-transfer. */
export function recordFailedTransfer(userId: string, fromAccountId: string, payeeId: string, amountCents: number) {
  const from = accountsFor(userId).find((a) => a.id === fromAccountId);
  const payee = payeesFor(userId).find((p) => p.id === payeeId);
  if (from && payee) record(from.id, `Transfer to ${payee.name}`, -amountCents, "failed");
}
