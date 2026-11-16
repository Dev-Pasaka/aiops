// Browser-side helpers shared by the pages.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Demo Bank is not responding right now.", 0);
  }

  if (res.status === 401 && path !== "/api/login") {
    // Outside React, so no router here; a full page load to the sign-in page is what we want.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
    throw new ApiError("Please sign in.", 401);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // 502/503/504 with no JSON body come from the proxy when the app itself is down.
    throw new ApiError(data?.error ?? "Demo Bank is not responding right now.", res.status);
  }
  return data as T;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const money = (cents: number) => usd.format(cents / 100);

export type Overview = {
  accounts: { id: string; name: string; number: string; balanceCents: number }[];
  transactions: {
    id: string;
    date: string;
    description: string;
    amountCents: number;
    status: "completed" | "failed";
    accountName: string;
  }[];
  payees: { id: string; name: string; detail: string }[];
};
