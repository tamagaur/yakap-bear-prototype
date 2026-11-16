"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { ClockDTO } from "@/lib/contracts/demo";

/**
 * Shared simulated demo clock (task B12). Polls the API and ticks locally
 * every second, so every view shows the same "now".
 */
export function useSimClock(refreshMs = 10_000) {
  const { data, error, mutate } = useSWR<ClockDTO>("/api/demo/clock", fetcher, {
    refreshInterval: refreshMs,
    revalidateOnFocus: true,
  });
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const now = useMemo(() => (data ? new Date(tick + data.offsetMs) : null), [data, tick]);
  return { now, demoMode: data?.demoMode ?? false, error, refresh: mutate, offsetMs: data?.offsetMs ?? 0 };
}
