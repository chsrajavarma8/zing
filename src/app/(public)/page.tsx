import Link from "next/link";
import { getPublicEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/site/countdown";
import { HeroVisual } from "@/components/site/hero-visual";
import { Reveal, StaggerReveal } from "@/components/motion/reveal";
import { getRegistrationStatus, registrationCtaLabel } from "@/lib/registration-status";
import {
  ArrowRight,
  Trophy,
  CheckCircle2,
  Megaphone,
  ShieldCheck,
  Layers,
  Users,
  Gavel,
  GraduationCap,
} from "lucide-react";
import type { Round } from "@/types/database";
import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { formatDate } from "@/lib/date";
import { MENTOR_COUNT_LABEL, JUDGE_COUNT_LABEL, ROUND_COUNT_LABEL, ELIGIBILITY_SUMMARY } from "@/lib/event-facts";

const HOME_DESCRIPTION =
  "Join Zing Hackathon by Skillglider. Build your own solution, compete across three rounds, and explore a ₹4,00,000 prize pool.";

export const metadata: Metadata = {
  title: { absolute: "Zing Hackathon by Skillglider | ₹4 Lakh Prize Pool" },
  description: HOME_DESCRIPTION,
  alternates: { canonical: getSiteUrl() },
  openGraph: {
    title: "Zing Hackathon by Skillglider | ₹4 Lakh Prize Pool",
    description: HOME_DESCRIPTION,
    url: getSiteUrl(),
    siteName: "Zing Hackathon by Skillglider",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zing Hackathon by Skillglider | ₹4 Lakh Prize Pool",
    description: HOME_DESCRIPTION,
  },
};

const CHECKLIST_ITEMS = ["Presentation", "Screenshots", "Demo video", "Codebase", "README"];

const ROUND_PREVIEW: Record<string, { icon: React.ComponentType<{ className?: string }>; blurb: string }> = {
  minor: { icon: ShieldCheck, blurb: "Demonstrate your skills through an online talent evaluation." },
  intermediate: { icon: Layers, blurb: "Develop your solution and present your progress according to the round requirements." },
  major: { icon: Trophy, blurb: "Present your final solution, demonstrate its capabilities, and explain your approach." },
};

export default async function HomePage() {
  const event = await getPublicEvent();
  const supabase = await createClient();

  if (!event) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <h1 className="font-heading text-2xl font-bold">No event configured yet</h1>
        <p className="mt-2 text-muted-foreground">An admin needs to configure and publish an event.</p>
      </main>
    );
  }

  const [{ data: rounds }, { data: announcements }, { data: prizeBlock }] = await Promise.all([
    supabase.from("rounds").select("*").eq("event_id", event.id).order("order_index"),
    supabase
      .from("announcements")
      .select("*")
      .eq("event_id", event.id)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(3),
    supabase.from("content_blocks").select("content").eq("event_id", event.id).eq("key", "prize_tiers").maybeSingle(),
  ]);

  const roundList = (rounds as unknown as Round[] | null) ?? [];
  const registrationStatus = getRegistrationStatus(event);
  const prizeTierContent = (prizeBlock?.content as Record<string, string> | null) ?? {};
  const prizeTiers = [
    { label: prizeTierContent.tier1_label || "1st", amount: prizeTierContent.tier1_amount || "₹2,00,000" },
    { label: prizeTierContent.tier2_label || "2nd", amount: prizeTierContent.tier2_amount || "₹1,50,000" },
    { label: prizeTierContent.tier3_label || "3rd", amount: prizeTierContent.tier3_amount || "₹50,000" },
  ];

  return (
    <main>
      {/* ============================= HERO ============================= */}
      {/* No local grid/blob here - the shared SiteBackground (mounted in
          the root layout) already provides stronger ambient motion on the
          homepage specifically; a second local effect would just double up. */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-28">
          {/* Oversized editorial headline, full-width - breaks out of any
              symmetric grid before the asymmetric two-column body below. */}
          <Reveal>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-rose">
              <span className="h-px w-8 bg-rose" /> Skillglider presents
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="mt-4 text-balance font-heading text-[clamp(2.75rem,10vw,8rem)] font-bold uppercase leading-[0.92] tracking-tight">
              {event.name}
            </h1>
          </Reveal>
        </div>

        {/* Asymmetric body: wide copy/actions column + narrower visual column */}
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-10 sm:px-6 sm:pb-32 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:pt-16">
          <div>
            <Reveal delay={0.12}>
              <p className="max-w-xl text-balance text-lg text-foreground/75 sm:text-xl">
                Identify a problem worth solving, bring your team together, and turn your idea into a working
                solution at {event.name}.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="mt-3 flex items-start gap-2 text-sm text-foreground/60">
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {ELIGIBILITY_SUMMARY}
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-10 flex flex-wrap items-baseline gap-3 border-t border-primary/15 pt-6">
                <span className="font-heading text-5xl font-bold tracking-tight sm:text-6xl">{event.prize_pool_label}</span>
                <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Total prize pool</span>
              </div>
            </Reveal>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StaggerReveal step={0.06}>
                {prizeTiers.map((tier) => (
                  <Badge key={tier.label} variant="outline" className="gap-1.5 border-primary/30 py-1.5 text-sm">
                    <Trophy className="h-3 w-3 text-primary" />
                    <span className="text-muted-foreground">{tier.label}</span>
                    <span className="font-semibold text-foreground">{tier.amount}</span>
                  </Badge>
                ))}
              </StaggerReveal>
            </div>

            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {registrationStatus.isOpen ? (
                  <Button size="lg" asChild className="glow-primary">
                    <Link href="/register">
                      Register your team <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" disabled>
                    {registrationCtaLabel(registrationStatus)}
                  </Button>
                )}
                <Button size="lg" variant="outline" asChild>
                  <Link href="/rounds">Explore the rounds</Link>
                </Button>
              </div>
            </Reveal>

            {registrationStatus.closesAt && registrationStatus.isOpen && (
              <Reveal delay={0.3}>
                <div className="mt-10">
                  <Countdown target={registrationStatus.closesAt} label="Registration closes in" />
                </div>
              </Reveal>
            )}
          </div>

          <div className="relative lg:pb-2">
            <Reveal delay={0.16}>
              <HeroVisual />
            </Reveal>

            {/* New floating accent: a layered, gently-rotated cream panel
                with a large round number - "layered cream panels" +
                "large round numbers" from the brief, entering with a
                restrained scale/opacity change rather than a slide. */}
            <Reveal delay={0.32} y={0} className="absolute -bottom-6 -left-6 hidden sm:block">
              <div
                className="pointer-events-none absolute inset-0 -z-10 translate-x-2 translate-y-2 rounded-3xl bg-primary/8"
                style={{ transform: "rotate(-6deg)" }}
                aria-hidden
              />
              <div
                className="rounded-3xl border border-primary/15 bg-cream px-6 py-5 shadow-[0_16px_40px_-16px_rgba(128,0,32,0.3)]"
                style={{ transform: "rotate(-3deg)" }}
              >
                <p className="font-heading text-4xl font-bold leading-none text-primary">03</p>
                <p className="mt-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Rounds to prove it</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ========================= EVENT HIGHLIGHTS ========================= */}
      <section className="border-y border-primary/12 bg-ivory py-14">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 sm:px-6 md:grid-cols-4">
          <StaggerReveal step={0.06}>
            <div className="text-center">
              <p className="font-heading text-3xl font-bold text-primary sm:text-4xl">{event.prize_pool_label}</p>
              <p className="mt-1 text-sm text-muted-foreground">Prize pool</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-3xl font-bold text-primary sm:text-4xl">{MENTOR_COUNT_LABEL}</p>
              <p className="mt-1 text-sm text-muted-foreground">Mentors</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-3xl font-bold text-primary sm:text-4xl">{JUDGE_COUNT_LABEL}</p>
              <p className="mt-1 text-sm text-muted-foreground">Judges</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-3xl font-bold text-primary sm:text-4xl">{ROUND_COUNT_LABEL}</p>
              <p className="mt-1 text-sm text-muted-foreground">Rounds</p>
            </div>
          </StaggerReveal>
        </div>
      </section>

      {/* ========================= WHO CAN PARTICIPATE ========================= */}
      <section className="bg-background py-24 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-rose">Who can participate</p>
            <h2 className="mt-4 text-balance font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">
              School or college, everyone builds together.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-foreground/75">{ELIGIBILITY_SUMMARY}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Card className="text-left">
                <CardContent className="flex items-start gap-3 py-6">
                  <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-heading font-semibold">School and college welcome</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      From school through graduate studies - registration only asks for details relevant to your
                      education level.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="text-left">
                <CardContent className="flex items-start gap-3 py-6">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-heading font-semibold">
                      Teams of {event.team_size_min}–{event.team_size_max}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Including your team lead. Build your team before you register.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================= ABOUT (editorial split) ========================= */}
      <section className="border-y border-primary/12 bg-cream py-24 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:gap-16">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-rose">Why {event.name}</p>
            <h2 className="mt-4 text-balance font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">
              Build something that matters: on a problem only your team chose.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col justify-center">
            <p className="text-lg text-foreground/75">
              {event.name} brings student teams together to explore problems, develop original solutions, and
              demonstrate what they can build. There&apos;s no fixed brief: your team identifies its own problem
              statement and carries it through three rounds.
            </p>
            <ul className="mt-8 space-y-4 border-l-2 border-primary/20 pl-5">
              <li>
                <p className="font-heading text-lg font-semibold">01: Your own problem statement</p>
                <p className="text-sm text-muted-foreground">Not assigned. Chosen and owned by your team.</p>
              </li>
              <li>
                <p className="font-heading text-lg font-semibold">02: Three rounds to prove it</p>
                <p className="text-sm text-muted-foreground">Talent, Intermediate, Major: each raising the bar.</p>
              </li>
              <li>
                <p className="font-heading text-lg font-semibold">03: One place for everything</p>
                <p className="text-sm text-muted-foreground">Submissions, updates, and results in your dashboard.</p>
              </li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ========================= ROUND PREVIEW ========================= */}
      {roundList.length > 0 && (
        <section className="bg-background py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <div className="mb-14 flex flex-wrap items-end justify-between gap-4">
                <h2 className="font-heading text-4xl font-bold sm:text-5xl">Three rounds. One journey.</h2>
                <Button variant="link" asChild className="group">
                  <Link href="/rounds" className="flex items-center gap-1">
                    Full round details
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/button:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </Reveal>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-primary/15 bg-primary/15 md:grid-cols-3">
              <StaggerReveal step={0.1}>
                {roundList.map((r, i) => {
                  const preview = ROUND_PREVIEW[r.key];
                  const Icon = preview?.icon ?? Trophy;
                  return (
                    <div key={r.id} className="flex flex-col gap-4 bg-ivory p-8">
                      <span className="font-heading text-sm font-bold text-rose">0{i + 1}</span>
                      <Icon className="h-6 w-6 text-primary" />
                      <p className="font-heading text-xl font-semibold">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{preview?.blurb ?? r.description}</p>
                    </div>
                  );
                })}
              </StaggerReveal>
            </div>
          </div>
        </section>
      )}

      {/* ========================= MENTORS AND JUDGES ========================= */}
      <section className="bg-background py-24 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-rose">Guided and evaluated</p>
            <h2 className="mt-4 text-balance font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">
              Mentors and judges backing your build.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Card className="card-glow border-primary/20">
                <CardContent className="flex flex-col items-center gap-2 py-10">
                  <Users className="h-7 w-7 text-primary" />
                  <p className="font-heading text-3xl font-bold">{MENTOR_COUNT_LABEL}</p>
                  <p className="text-sm font-medium text-muted-foreground">Mentors</p>
                  <p className="mt-2 text-sm text-muted-foreground">Lineup to be announced.</p>
                </CardContent>
              </Card>
              <Card className="card-glow border-primary/20">
                <CardContent className="flex flex-col items-center gap-2 py-10">
                  <Gavel className="h-7 w-7 text-primary" />
                  <p className="font-heading text-3xl font-bold">{JUDGE_COUNT_LABEL}</p>
                  <p className="text-sm font-medium text-muted-foreground">Judges</p>
                  <p className="mt-2 text-sm text-muted-foreground">Lineup to be announced.</p>
                </CardContent>
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================= SUBMISSION PREVIEW ========================= */}
      <section className="border-y border-primary/12 bg-cream py-24 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <div className="mb-10 text-center">
              <h2 className="font-heading text-4xl font-bold sm:text-5xl">One folder. Your complete project.</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Submit one public Google Drive folder containing your presentation, screenshots, demo video,
                codebase, and README.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="card-glow border-primary/20">
              <CardContent className="grid gap-6 py-8 sm:grid-cols-2">
                <ul className="space-y-3">
                  {CHECKLIST_ITEMS.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-base">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> {item}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col justify-center gap-3 border-t border-primary/15 pt-6 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                  <Button variant="outline" asChild className="w-fit">
                    <Link href="/submission-guidelines">
                      View submission guidelines <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ========================= UPDATES ========================= */}
      <section className="bg-background py-24 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <div className="mb-10 text-center">
              <div className="mb-3 flex items-center justify-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-4xl font-bold sm:text-5xl">Stay ready for what&apos;s next.</h2>
              </div>
              <p className="mx-auto max-w-xl text-muted-foreground">
                Check your dashboard regularly for announcements, deadlines, presentation schedules, and results.
              </p>
            </div>
          </Reveal>
          {announcements && announcements.length > 0 ? (
            <div className="space-y-3">
              {(announcements as unknown as { id: string; title: string; body: string; published_at: string }[]).map((a, i) => (
                <Reveal key={a.id} delay={i * 0.08}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <CardDescription>{formatDate(a.published_at)}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">{a.body}</CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal delay={0.1}>
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Announcements will appear here when published.
                </CardContent>
              </Card>
            </Reveal>
          )}
        </div>
      </section>

      {/* ========================= CLOSING ========================= */}
      <section className="relative overflow-hidden border-t border-primary/12 bg-cream">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ background: "radial-gradient(ellipse 60% 60% at 50% 100%, var(--rose), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-28">
          <Reveal>
            <Badge variant="outline" className="border-primary/30 text-xs uppercase tracking-widest">
              {registrationStatus.isOpen ? "Registration open" : "Registration status"}
            </Badge>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="font-heading text-4xl font-bold sm:text-6xl">Bring the problem. Build the possibility.</h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="max-w-xl text-lg text-muted-foreground">Start your {event.name} journey with your team.</p>
          </Reveal>
          <Reveal delay={0.18}>
            {registrationStatus.isOpen ? (
              <Button size="lg" asChild className="glow-primary">
                <Link href="/register">
                  Register your team <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button size="lg" variant="secondary" disabled>
                {registrationCtaLabel(registrationStatus)}
              </Button>
            )}
          </Reveal>
        </div>
      </section>
    </main>
  );
}
