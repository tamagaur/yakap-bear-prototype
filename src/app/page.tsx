import { Hospital, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Bear } from "@/components/bear/bear-figure";
import { ClockCard, HeroActions, Journeys, LiveStrip, RoleCards, VoiceCard } from "@/components/launcher/launcher";
import { BearMark, Logo } from "@/components/shared/logo";
import { Parallax, Reveal } from "@/components/ui/reveal";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#who-its-for", label: "Who it's for" },
  { href: "#guided-demo", label: "Guided demo" },
  { href: "#about", label: "About" },
];

/** Launcher: the home of the whole prototype (task S9). */
export default function LauncherPage() {
  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-30 border-b border-[rgba(122,96,74,0.16)] bg-cream/90 backdrop-blur-[14px]">
        <div className="mx-auto flex h-[76px] max-w-[1260px] items-center gap-6 px-5 tablet:h-[82px] tablet:gap-9 tablet:px-[46px]">
          <Logo subtitle="A warm hug between visits" />
          <nav aria-label="Landing page navigation" className="ml-auto hidden items-center gap-1 mobile:flex tablet:gap-3">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="inline-flex min-h-11 items-center rounded-lg px-2 text-body-sm font-semibold text-muted transition-colors duration-200 hover:text-teal"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <span className="hidden border-l border-line pl-6 text-body-sm text-muted tablet:inline">
            Student startup prototype · Philippines
          </span>
        </div>
      </header>

      <main className="overflow-hidden">
        {/* hero */}
        <section
          id="how-it-works"
          className="mx-auto grid max-w-[1260px] scroll-mt-24 items-center gap-6 px-5 py-10 tablet:min-h-[610px] tablet:grid-cols-[1.06fr_0.94fr] tablet:px-[46px] tablet:py-14"
        >
          <Parallax speed={0.14} fade>
            <p className="eyebrow text-cocoa-700">A reminder that sounds like home</p>
            <h1 className="mt-4 max-w-[650px] text-display-sm font-extrabold text-cocoa tablet:text-display">
              Helping every dose feel like a{" "}
              <span className="relative whitespace-nowrap text-teal">
                warm yakap.
                <svg
                  viewBox="0 0 200 8"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1.5 left-1 h-[7px] w-[calc(100%-4px)]"
                  aria-hidden
                >
                  <path
                    d="M0 5 Q12.5 0 25 5 T50 5 T75 5 T100 5 T125 5 T150 5 T175 5 T200 5"
                    fill="none"
                    stroke="#dfa526"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-[610px] text-body-lg text-muted tablet:text-lede">
              Yakap Bear plays a loved one&apos;s recorded reminder. One gentle 3-second paw hold logs each dose: no
              microphone, no monitoring.
            </p>
            <HeroActions />
            <ClockCard />
          </Parallax>

          <div className="relative mx-auto grid h-[440px] w-full max-w-[520px] place-items-center pb-[90px] tablet:h-[490px] tablet:pb-0">
            <Parallax speed={0.24} className="absolute inset-0">
            <span
              className="absolute inset-x-0 top-[30px] mx-auto size-[290px] rounded-full bg-[#f2dca8] tablet:inset-0 tablet:m-auto tablet:size-[370px]"
              aria-hidden
            />
            <span
              className="absolute inset-x-0 top-[15px] mx-auto size-[320px] rotate-[8deg] rounded-[48%_52%_54%_46%] border-2 border-dashed border-[#d1a860] tablet:inset-0 tablet:m-auto tablet:size-[400px]"
              aria-hidden
            />
            <span
              className="absolute top-4 right-0 rotate-[19deg] text-[11px] tracking-[0.18em] text-honey-dark tablet:top-7 tablet:right-2"
              aria-hidden
            >
              dose time • yakap time •
            </span>
            </Parallax>
            <Parallax speed={0.1} className="relative">
              <Bear expression="happy" motion="breathe" className="w-[230px] tablet:w-[320px]" />
            </Parallax>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 tablet:right-0 tablet:bottom-9 tablet:left-auto tablet:translate-x-0">
              <Parallax speed={-0.06}>
                <VoiceCard />
              </Parallax>
            </div>
          </div>
        </section>

        {/* roles */}
        <section id="who-its-for" className="scroll-mt-20 border-t border-line bg-paper">
          <div className="mx-auto max-w-[1260px] px-5 py-12 tablet:px-[46px] tablet:py-16">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-honey-dark">Choose a view</p>
                <h2 className="mt-3 text-title font-bold text-cocoa tablet:text-section">Whose day are you joining?</h2>
              </div>
              <p className="max-w-[330px] text-body-lg text-muted">
                Every surface has a role. The demo clock is shared across all of them.
              </p>
            </Reveal>
            <div className="mt-8">
              <RoleCards />
            </div>
          </div>
        </section>

        {/* live strip */}
        <Reveal from="scale" className="mx-auto max-w-[1260px] px-5 pt-8 tablet:px-[46px]">
          <LiveStrip />
        </Reveal>

        {/* journeys */}
        <section id="guided-demo" className="mx-auto max-w-[1260px] scroll-mt-20 px-5 py-14 tablet:px-[46px] tablet:py-20">
          <Journeys />
        </section>

        {/* business */}
        <section id="about" className="scroll-mt-20 bg-cream-deep">
          <div className="mx-auto max-w-[1260px] px-5 py-14 tablet:px-[46px] tablet:py-20">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-cocoa-700">The business in brief</p>
                <h2 className="mt-3 text-title font-bold text-cocoa tablet:text-section">
                  Designed to support care,
                  <br />
                  not replace it.
                </h2>
              </div>
              <p className="max-w-[520px] text-body-lg text-muted">
                A student-led concept from the Philippines for maintenance medication routines, family reassurance, and
                more useful check-ups.
              </p>
            </Reveal>

            <div className="mt-9 grid gap-4 tablet:grid-cols-3">
              <StoryCard delay={0} tint="bg-butter" eyebrow="The need" title="Missed doses are often a human problem.">
                Forgetfulness, routines, and distance can make long-term medication hard to sustain.
              </StoryCard>
              <StoryCard delay={110} tint="bg-mint" eyebrow="Our promise" title="A familiar voice, right on time.">
                Warm reminders, simple check-ins, and only the minimum information shared.
              </StoryCard>
              <StoryCard delay={220} tint="bg-lavender" eyebrow="For care teams" title="Patterns for better conversations.">
                Clinicians see consented dose logs, never audio, private moments, or surveillance.
              </StoryCard>
            </div>

            <Reveal className="mt-5 grid divide-y divide-line rounded-soft border border-line bg-paper shadow-card tablet:grid-cols-3 tablet:divide-x tablet:divide-y-0">
              <PlanCell icon={<BearMark className="size-5" />} eyebrow="Starter" title="One-time bear purchase">
                Includes the family app and 6 months of SMS alerts.
              </PlanCell>
              <PlanCell icon={<Users className="size-5" aria-hidden />} eyebrow="Optional" title="Family plan">
                Continue alerts after the included period.
              </PlanCell>
              <PlanCell
                icon={<Hospital className="size-5" aria-hidden />}
                eyebrow="Clinic plan"
                title={
                  <>
                    ₱30,000 <span className="text-body-sm font-medium text-muted">/ year · prototype reference</span>
                  </>
                }
              >
                Consented insights, audit tools, and bulk-order lending.
              </PlanCell>
            </Reveal>
            <p className="mt-5 text-center text-body-sm text-muted">
              Add-ons: spare washable covers · extended warranty · bulk orders for clinic lending programs
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto grid max-w-[1260px] gap-9 px-5 py-11 text-body-sm text-muted mobile:grid-cols-[1.2fr_0.8fr] tablet:grid-cols-[1.4fr_0.65fr_1fr] tablet:gap-20 tablet:px-[46px] tablet:py-[54px]">
        <div>
          <Logo subtitle="A warm hug between visits" />
          <p className="mt-4 max-w-[360px] leading-relaxed">
            A comforting medication reminder concept that brings a loved one&apos;s voice into everyday care.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="grid content-start gap-1">
          <p className="font-display mb-1 text-sm font-bold text-cocoa">Explore</p>
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex min-h-9 items-center font-semibold transition-colors duration-200 hover:text-teal"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="mobile:col-span-2 tablet:col-span-1">
          <p className="font-display text-sm font-bold text-cocoa">Student startup prototype</p>
          <p className="mt-2.5 leading-relaxed">Academic prototype with fictional data. Texts and payments are simulated.</p>
          <p className="mt-2.5 font-bold text-teal">Made with care in the Philippines</p>
        </div>
      </footer>
    </div>
  );
}

function StoryCard({
  tint,
  eyebrow,
  title,
  delay,
  children,
}: {
  tint: string;
  eyebrow: string;
  title: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <Reveal delay={delay} className="flex">
      <article
        className={`motion-lift w-full rounded-card p-7 shadow-card transition-[box-shadow,translate] duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover ${tint}`}
      >
        <p className="eyebrow text-cocoa-700">{eyebrow}</p>
        <h3 className="mt-7 text-card-title font-bold text-cocoa">{title}</h3>
        <p className="mt-2.5 text-body text-cocoa-700">{children}</p>
      </article>
    </Reveal>
  );
}

function PlanCell({ icon, eyebrow, title, children }: { icon: ReactNode; eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-4 p-6">
      <span className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-cream-deep text-cocoa" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="eyebrow text-honey-dark">{eyebrow}</p>
        <h3 className="mt-1.5 text-[17px] font-bold text-cocoa">{title}</h3>
        <p className="mt-1.5 text-body text-muted">{children}</p>
      </div>
    </div>
  );
}
