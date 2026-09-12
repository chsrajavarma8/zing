"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  label: string;
}

export function StepIndicator({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <nav aria-label="Registration progress" className="mb-8">
      {/* Desktop: full labeled steps */}
      <ol className="hidden items-center sm:flex">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary text-primary glow-primary",
                    !done && !active && "border-border text-muted-foreground",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn("mx-2 h-px flex-1 transition-colors", done ? "bg-primary" : "bg-border")} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: compact progress bar with current label */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{steps[current]?.label}</span>
          <span className="text-muted-foreground">
            Step {current + 1} of {steps.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}
