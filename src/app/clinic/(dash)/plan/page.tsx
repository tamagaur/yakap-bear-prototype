import { Boxes, Check, Info } from "lucide-react";
import { PageHeader } from "@/components/clinic/clinic-shell";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

const FEATURES = [
  "Dose log dashboard for every patient who consents to you",
  "Adherence summaries (on time, late, missed) for 7 and 30 days",
  "Weekly missed-dose patterns (weekday × dose time)",
  "CSV and PDF export for check-ups and records",
  "Clinic audit log of every view, export and consent change",
];

/** Clinic subscription page (task D6) — informational mock, no payments. */
export default function ClinicPlanPage() {
  return (
    <>
      <PageHeader title="Clinic plan" description="Paid by clinics, never by patients (from the Yakap business model)." />
      <Notice tone="info" className="mb-5" title="Prototype information only">
        No real subscription, invoice or payment exists in this demo. Prices are the proposed figures from the business
        model canvas.
      </Notice>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-6">
          <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-500">Clinic dashboard subscription</p>
          <p className="mt-2 text-4xl font-black text-cocoa-900">
            ₱30,000 <span className="text-lg font-bold text-cocoa-600">/ year</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-cocoa-600">Per clinic · proposed price</p>
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
        <div className="space-y-5">
          <Card className="p-6">
            <span className="grid size-11 place-items-center rounded-2xl bg-honey-200 text-cocoa-800">
              <Boxes className="size-5" aria-hidden />
            </span>
            <h2 className="mt-3 text-lg font-black">Bulk bear orders</h2>
            <p className="mt-1 text-sm text-cocoa-700">
              Clinics and hospitals can order bears in bulk to lend to patients, with washable plush covers and extended
              warranty as add-ons. Pricing is arranged per order.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-3 py-1 text-xs font-bold text-cocoa-700">
              <Info className="size-3.5" aria-hidden /> Contact form not part of the prototype
            </p>
          </Card>
          <Card className="p-6">
            <h2 className="text-base font-black">For families</h2>
            <p className="mt-1 text-sm text-cocoa-700">
              Each bear includes 6 months of alerts and app access; families can continue with an optional family plan.
              Patients never pay for the clinic dashboard.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
