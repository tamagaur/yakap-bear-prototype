"use client";

import { LogIn, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { useSimClock } from "@/hooks/use-sim-clock";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { DEMO_PASSWORD, type ResetResultDTO } from "@/lib/contracts/demo";
import { formatDate, formatTime } from "@/lib/time";

/** One-click sign-in for a seeded demo account. */
export function QuickLogin({ email, area, next, label }: { email: string; area: "clinic" | "family"; next: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="dark"
        size="md"
        loading={busy}
        icon={<LogIn className="size-4" />}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await apiFetch("/api/auth/login", { json: { email, password: DEMO_PASSWORD, area } });
            router.push(next);
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {error && <p className="text-xs font-semibold text-missed-ink">{error}</p>}
    </div>
  );
}

/** Demo clock + one-click reset (tasks B13, S9). */
export function DemoReset() {
  const { now, demoMode, error, refresh } = useSimClock(5000);
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResetResultDTO | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const reset = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const r = await apiFetch<ResetResultDTO>("/api/demo/reset", { json: {} });
      setResult(r);
      setOpen(false);
      await refresh();
      await mutate(() => true, undefined, { revalidate: true });
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-500">Shared demo clock</p>
      {error ? (
        <Notice tone="error" className="mt-2" title="The Yakap API isn't reachable">
          Start the Rust server with <code>npm run dev:api</code> (see README), then reload this page.
        </Notice>
      ) : (
        <>
          <p className="mt-1 text-4xl font-black text-cocoa-900 tabular">{now ? formatTime(now) : "—"}</p>
          <p className="text-sm font-semibold text-cocoa-600">{now ? formatDate(now) : "Loading…"} · Asia/Manila</p>
        </>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => setOpen(true)} disabled={!demoMode || !!error}>
          Reset demo
        </Button>
        {!demoMode && !error && <span className="text-xs font-semibold text-cocoa-500">Demo mode is off on this server.</span>}
      </div>
      {result && (
        <Notice tone="success" className="mt-3" title="Demo data restored">
          Clock set to {formatTime(result.now)}. {result.counts.patients} patients, {result.counts.doseEvents} dose records,{" "}
          {result.counts.alerts} alerts and {result.counts.sms} simulated SMS rebuilt.
        </Notice>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reset the demo?"
        description="This wipes every change made during the demo (holds, recordings, consents, sign-ups) and rebuilds the fictional dataset. The clock goes back to 7:45 PM today, 15 minutes before Lola Rosa's 8:00 PM dose."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={reset}>
              Reset demo data
            </Button>
          </>
        }
      >
        {failure && <Notice tone="error">{failure}</Notice>}
      </Dialog>
    </div>
  );
}
