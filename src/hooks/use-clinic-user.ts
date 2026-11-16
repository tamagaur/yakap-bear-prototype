"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { MeResponse } from "@/lib/contracts/auth";

/** Signed-in clinic user (clinician or clinic admin), or null. */
export function useClinicUser() {
  const { data, error, isLoading, mutate } = useSWR<MeResponse>("/api/auth/me?area=clinic", fetcher, {
    revalidateOnFocus: true,
  });
  return { user: data?.user ?? null, loaded: !!data, error, isLoading, mutate };
}
