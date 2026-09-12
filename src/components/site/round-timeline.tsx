"use client";

import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Clock, ShieldCheck, Code2, Presentation } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { Round } from "@/types/database";

const ICONS = { minor: ShieldCheck, intermediate: Code2, major: Presentation } as const;

export function RoundTimeline({ rounds }: { rounds: Round[] }) {
  return (
    <div className="relative">
      {/* connecting line: horizontal on desktop, vertical on mobile */}
      <div
        className="absolute top-1/2 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block"
        aria-hidden
      />
      <div className="absolute left-5 hidden h-full w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent md:hidden sm:block" aria-hidden />

      <ol className="relative grid gap-6 md:grid-cols-3">
        {rounds.map((r, i) => {
          const Icon = ICONS[r.key] ?? ShieldCheck;
          return (
            <Reveal key={r.id} delay={i * 0.12}>
              <li className="relative pl-14 md:pl-0 md:text-center">
                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-card text-primary md:static md:mx-auto md:mb-5">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="mb-2">
                  Round {i + 1}
                </Badge>
                <h3 className="font-heading text-xl font-semibold">{r.name}</h3>
                <p className="mt-2 text-base text-muted-foreground">{r.description}</p>
                {r.starts_at || r.ends_at ? (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground md:justify-center">
                    <Clock className="h-3.5 w-3.5" />
                    {r.starts_at ? formatDate(r.starts_at) : "TBA"}
                    {r.ends_at ? ` – ${formatDate(r.ends_at)}` : ""}
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground md:justify-center">
                    <Clock className="h-3.5 w-3.5" /> To be announced
                  </p>
                )}
              </li>
            </Reveal>
          );
        })}
      </ol>
    </div>
  );
}
