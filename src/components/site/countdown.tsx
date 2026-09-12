"use client";

import { useEffect, useState } from "react";

function getParts(target: number) {
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    done: diff <= 0,
  };
}

export function Countdown({ target, label }: { target: string; label: string }) {
  const targetMs = Date.parse(target);
  const [parts, setParts] = useState(() => getParts(targetMs));

  useEffect(() => {
    const id = setInterval(() => setParts(getParts(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (parts.done) {
    return <p className="text-sm text-muted-foreground">{label} has passed.</p>;
  }

  const units: [string, number][] = [
    ["Days", parts.days],
    ["Hours", parts.hours],
    ["Min", parts.minutes],
    ["Sec", parts.seconds],
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
            <span className="font-mono text-2xl font-bold tabular-nums">{String(value).padStart(2, "0")}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
