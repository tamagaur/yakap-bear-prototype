"use client";

import clsx from "clsx";
import { Boxes, Calculator, Check, Info, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/clinic/clinic-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/status-pill";

/**
 * Placeholder pricing from the initial planning sheet.
 * Update these numbers in one place once the team locks final pricing.
 */
const DEFAULT_PRICING = {
  clinicAnnualPhp: 30_000,
  bearUnitPhp: 2_500,
  spareCoverPhp: 350,
  extendedWarrantyPhp: 450,
};

const FEATURES = [
  "Dose log dashboard for every patient who consents to you",
  "Adherence summaries (on time, late, missed) for 7 and 30 days",
  "Weekly missed-dose patterns (weekday × dose time) & 1-page check-up sheet",
  "CSV and PDF export for check-ups and records",
  "Clinic audit log of every view, export and consent change",
];

const BEAR_PRESETS = [5, 10, 20, 50] as const;

function php(amount: number) {
  return `₱${Math.max(0, Math.round(amount)).toLocaleString("en-PH")}`;
}

/** Clinic subscription & bulk lending estimator page (task D6) — informational mock, no payments. */
export default function ClinicPlanPage() {
  const [clinicAnnual, setClinicAnnual] = useState(DEFAULT_PRICING.clinicAnnualPhp);
  const [bearUnit, setBearUnit] = useState(DEFAULT_PRICING.bearUnitPhp);
  const [bearsCount, setBearsCount] = useState(10);
  const [includeCovers, setIncludeCovers] = useState(true);
  const [includeWarranty, setIncludeWarranty] = useState(false);
  const [editRates, setEditRates] = useState(false);

  const bearsSubtotal = bearsCount * bearUnit;
  const coversSubtotal = includeCovers ? bearsCount * DEFAULT_PRICING.spareCoverPhp : 0;
  const warrantySubtotal = includeWarranty ? bearsCount * DEFAULT_PRICING.extendedWarrantyPhp : 0;
  const totalFirstYear = clinicAnnual + bearsSubtotal + coversSubtotal + warrantySubtotal;

  const resetDefaults = () => {
    setClinicAnnual(DEFAULT_PRICING.clinicAnnualPhp);
    setBearUnit(DEFAULT_PRICING.bearUnitPhp);
    setBearsCount(10);
    setIncludeCovers(true);
    setIncludeWarranty(false);
  };

  return (
    <>
      <PageHeader
        title="Clinic plan"
        description="Paid by clinics, never by patients (from the Yakap business model)."
      />
      <Notice tone="info" className="mb-5" title="Prototype information only · placeholder pricing">
        No real subscription, invoice or payment exists in this demo. Prices shown below are proposed planning figures and
        can be adjusted once your team finalizes the financial model.
      </Notice>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1.15fr]">
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
                Clinic dashboard subscription
              </p>
              <Pill tone="warning" compact>
                Proposed placeholder
              </Pill>
            </div>
            <p className="mt-2 font-display text-4xl font-black text-cocoa-900 tabular">
              {php(clinicAnnual)} <span className="text-lg font-bold text-cocoa-600">/ year</span>
            </p>
            <p className="mt-1 text-sm font-semibold text-cocoa-600">
              Per clinic · unlimited consenting patients &amp; clinicians
            </p>
            <ul className="mt-5 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm font-semibold text-cocoa-800">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-taken-soft text-taken-ink">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-2xl bg-cream-100 p-4 text-sm">
              <p className="font-bold text-cocoa-800">Demo status</p>
              <p className="mt-1 text-cocoa-700">Kalinga Mind Clinic · pilot clinic (mock) · no billing</p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-black text-cocoa-900">For families</h2>
            <p className="mt-1 text-sm text-cocoa-700">
              Each bear includes 6 months of SMS alerts and family app access; families can continue with an optional
              family plan after the included period. Patients never pay for the clinic dashboard.
            </p>
          </Card>
        </div>

        <Card className="flex flex-col">
          <CardHeader
            icon={<Calculator className="size-4" aria-hidden />}
            title="Bulk bear lending & plan estimator"
            description="Estimate a clinic lending cohort (dashboard license + bears to lend to patients)."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<SlidersHorizontal className="size-3.5" aria-hidden />}
                onClick={() => setEditRates((v) => !v)}
              >
                {editRates ? "Hide rates" : "Adjust rates"}
              </Button>
            }
          />

          <div className="flex-1 space-y-5 p-5">
            {editRates && (
              <div className="rounded-xl border border-line bg-cream/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-600">
                    Placeholder unit prices (PHP)
                  </p>
                  <button
                    type="button"
                    onClick={resetDefaults}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal hover:underline"
                  >
                    <RotateCcw className="size-3" aria-hidden /> Reset defaults
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="rate-clinic" className="block text-xs font-bold text-cocoa-700">
                      Annual clinic license (₱/yr)
                    </label>
                    <Input
                      id="rate-clinic"
                      type="number"
                      min={0}
                      step={1000}
                      value={clinicAnnual}
                      onChange={(e) => setClinicAnnual(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 h-9 text-sm tabular"
                    />
                  </div>
                  <div>
                    <label htmlFor="rate-bear" className="block text-xs font-bold text-cocoa-700">
                      Yakap Bear unit price (₱/bear)
                    </label>
                    <Input
                      id="rate-bear"
                      type="number"
                      min={0}
                      step={100}
                      value={bearUnit}
                      onChange={(e) => setBearUnit(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 h-9 text-sm tabular"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label htmlFor="bears-range" className="text-sm font-extrabold text-cocoa-900">
                  Bears for clinic lending program
                </label>
                <span className="font-display text-2xl font-extrabold text-teal tabular">
                  {bearsCount} {bearsCount === 1 ? "bear" : "bears"}
                </span>
              </div>
              <input
                id="bears-range"
                type="range"
                min={0}
                max={50}
                step={1}
                value={bearsCount}
                onChange={(e) => setBearsCount(Number(e.target.value))}
                className="mt-2.5 h-2 w-full cursor-pointer accent-teal"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BEAR_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBearsCount(n)}
                    className={clsx(
                      "rounded-lg px-2.5 py-1 text-xs font-bold tabular transition-colors",
                      bearsCount === n
                        ? "bg-teal text-white"
                        : "bg-cream-200/70 text-cocoa-700 hover:bg-cream-300",
                    )}
                  >
                    {n} bears
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-500">Optional add-ons</p>
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-line bg-paper p-3 text-sm">
                <span className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={includeCovers}
                    onChange={(e) => setIncludeCovers(e.target.checked)}
                    className="mt-0.5 size-4 rounded accent-teal"
                  />
                  <span>
                    <span className="block font-bold text-cocoa-900">Spare washable plush covers</span>
                    <span className="text-xs text-cocoa-600">
                      For hygiene when lending bears between patient cohorts ({php(DEFAULT_PRICING.spareCoverPhp)}/bear)
                    </span>
                  </span>
                </span>
                <span className="font-bold text-cocoa-800 tabular">{php(coversSubtotal)}</span>
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-line bg-paper p-3 text-sm">
                <span className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={includeWarranty}
                    onChange={(e) => setIncludeWarranty(e.target.checked)}
                    className="mt-0.5 size-4 rounded accent-teal"
                  />
                  <span>
                    <span className="block font-bold text-cocoa-900">Extended clinic hardware warranty</span>
                    <span className="text-xs text-cocoa-600">
                      Covers paw-sensor and speaker replacements ({php(DEFAULT_PRICING.extendedWarrantyPhp)}/bear)
                    </span>
                  </span>
                </span>
                <span className="font-bold text-cocoa-800 tabular">{php(warrantySubtotal)}</span>
              </label>
            </div>

            <div className="rounded-soft border border-line bg-cream/60 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-600">
                Estimated 1st-year clinic package (placeholder)
              </p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-cocoa-700">
                  <dt>Clinic dashboard license (1 year)</dt>
                  <dd className="font-bold tabular">{php(clinicAnnual)}</dd>
                </div>
                <div className="flex justify-between text-cocoa-700">
                  <dt>
                    {bearsCount} × Yakap Bear ({php(bearUnit)} each)
                  </dt>
                  <dd className="font-bold tabular">{php(bearsSubtotal)}</dd>
                </div>
                {includeCovers && (
                  <div className="flex justify-between text-cocoa-700">
                    <dt>{bearsCount} × Spare washable cover</dt>
                    <dd className="font-bold tabular">{php(coversSubtotal)}</dd>
                  </div>
                )}
                {includeWarranty && (
                  <div className="flex justify-between text-cocoa-700">
                    <dt>{bearsCount} × Extended hardware warranty</dt>
                    <dd className="font-bold tabular">{php(warrantySubtotal)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between border-t border-cocoa-200 pt-2.5 text-base font-black text-cocoa-900">
                  <dt>Estimated total</dt>
                  <dd className="font-display text-2xl text-cocoa-900 tabular">{php(totalFirstYear)}</dd>
                </div>
              </dl>
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-cocoa-600">
                <Boxes className="size-3.5 shrink-0 text-cocoa-700" aria-hidden />
                <Info className="size-3.5 shrink-0 text-cocoa-500" aria-hidden />
                Planning estimate only — no checkout or billing in this academic prototype.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
