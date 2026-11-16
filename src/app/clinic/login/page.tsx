"use client";

import { LogIn, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { DemoBar } from "@/components/shared/demo-bar";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { DEMO_PASSWORD } from "@/lib/contracts/demo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", { json: { email, password, area: "clinic" } });
      const next = params.get("next");
      router.replace(next && next.startsWith("/clinic/") && next !== "/clinic/login" ? next : "/clinic");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const fill = (who: string) => {
    setEmail(who);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy} icon={<LogIn className="size-4" />} disabled={!email || !password}>
        Sign in
      </Button>
      <div className="rounded-2xl bg-cream-100 p-4 text-sm">
        <p className="font-bold text-cocoa-800">Demo accounts</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => fill("doctor@yakap.demo")}>
            Dr. Paolo Reyes · clinician
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fill("admin@yakap.demo")}>
            Carla Dizon · clinic admin
          </Button>
        </div>
        <p className="mt-2 text-xs text-cocoa-500">Demo-only password: {DEMO_PASSWORD}</p>
      </div>
    </form>
  );
}

export default function ClinicLoginPage() {
  return (
    <div className="min-h-dvh">
      <DemoBar />
      <div className="mx-auto grid min-h-[calc(100dvh-28px)] max-w-5xl items-center gap-10 px-4 py-10 md:grid-cols-2">
        <div className="hidden md:block">
          <Logo subtitle="Clinic dashboard" />
          <h1 className="mt-8 text-4xl font-black leading-tight text-cocoa-900">Real dose data for every check-up.</h1>
          <p className="mt-4 text-lg font-semibold text-cocoa-700">
            See the self-reported taken, late and missed log and the weekly patterns — instead of asking “did you take
            your meds?”.
          </p>
          <p className="mt-6 flex items-start gap-2 text-sm font-semibold text-cocoa-600">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-taken" aria-hidden />
            You only see patients whose family signed written consent for you. Every view and export is recorded in the
            audit log.
          </p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-lift ring-1 ring-cocoa-200 sm:p-8">
          <div className="md:hidden">
            <Logo subtitle="Clinic dashboard" />
          </div>
          <h2 className="mt-4 text-2xl font-black md:mt-0">Clinician sign-in</h2>
          <p className="mb-6 mt-1 text-sm text-cocoa-600">Kalinga Mind Clinic · demo environment</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
