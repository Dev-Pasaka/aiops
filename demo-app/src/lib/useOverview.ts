"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Overview } from "./client";

/** Loads the customer's accounts and refreshes every few seconds, so outages show up live. */
export function useOverview(intervalMs = 5000) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Overview>("/api/accounts"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your accounts.");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, intervalMs]);

  return { data, error, reload: load };
}
