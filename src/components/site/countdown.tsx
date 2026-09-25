"use client";

import { useEffect, useState } from "react";

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function getParts(target: number, now: number): Parts {
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    done: diff <= 0,
  };
}

// BUG-028: the first render (server and client hydration) is time-independent
// - placeholders, not Date.now() - so server and client markup always match.
// The live values start in an effect, which also owns the interval cleanup.
// An unparseable target renders nothing instead of "NaN".
export function Countdown({ target, label }: { target: string; label: string }) {
  const targetMs = Date.parse(target);
  const valid = Number.isFinite(targetMs);
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    if (!valid) return;
    const tick = () => setParts(getParts(targetMs, Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs, valid]);

  if (!valid) return null;

  if (parts?.done) {
    return <p className="text-sm text-muted-foreground">{label} has passed.</p>;
  }

  const units: [string, number | null][] = [
    ["Days", parts?.days ?? null],
    ["Hours", parts?.hours ?? null],
    ["Min", parts?.minutes ?? null],
    ["Sec", parts?.seconds ?? null],
  ];

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-3" role="timer" aria-live="off">
        {units.map(([unit, value]) => (
          <div
            key={unit}
            className="card-glow flex w-16 flex-col items-center rounded-xl border bg-card/60 py-3 backdrop-blur"
          >
            <span className="font-mono text-2xl font-bold tabular-nums">{value === null ? "--" : String(value).padStart(2, "0")}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
