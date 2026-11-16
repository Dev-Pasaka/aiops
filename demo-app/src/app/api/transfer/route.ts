import { json, route } from "@/lib/api";
import { transferShouldFail } from "@/lib/chaos";
import { log } from "@/lib/log";
import { metrics } from "@/lib/metrics";
import { currentUser } from "@/lib/session";
import { recordFailedTransfer, transfer } from "@/lib/store";

const REJECTIONS = {
  account_not_found: "Choose one of your own accounts to pay from.",
  payee_not_found: "Choose who you want to pay.",
  invalid_amount: "Enter an amount between $0.01 and $100,000.",
  insufficient_funds: "You don't have enough money in that account.",
} as const;

export const POST = route("/api/transfer", async (req) => {
  const user = currentUser(req);
  if (!user) return json({ error: "Not signed in." }, 401);

  const body = await req.json().catch(() => null);
  const fromAccountId = String(body?.fromAccountId ?? "");
  const payeeId = String(body?.payeeId ?? "");
  const amountCents = Math.round(Number(body?.amount) * 100);
  const note = String(body?.note ?? "").slice(0, 60);

  // Simulated downstream failure: the payment gateway times out (chaos "transfer failures").
  if (transferShouldFail()) {
    recordFailedTransfer(user.id, fromAccountId, payeeId, amountCents);
    metrics.transfers.inc({ result: "failed" });
    log("error", "transfer_failed", {
      user: user.id,
      amount_cents: amountCents,
      message: "Payment gateway timeout after 5000ms (injected by chaos transfer failure rate).",
    });
    return json({ error: "We couldn't complete your transfer. No money has left your account." }, 502);
  }

  const result = transfer(user.id, fromAccountId, payeeId, amountCents, note);
  if (!result.ok) {
    metrics.transfers.inc({ result: "rejected" });
    log("info", "transfer_rejected", { user: user.id, reason: result.reason });
    return json({ error: REJECTIONS[result.reason] }, 422);
  }

  metrics.transfers.inc({ result: "success" });
  metrics.transferAmount.inc(amountCents);
  log("info", "transfer_completed", { user: user.id, amount_cents: amountCents });
  return json({ ok: true, newBalanceCents: result.newBalanceCents });
});
