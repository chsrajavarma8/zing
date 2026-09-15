import Link from "next/link";
import { cn } from "@/lib/utils";

// Shown at the top of both /rounds/minor and /rounds/advanced so every round
// page can reach every other round, not just the two sharing /rounds/advanced.
export function RoundNavTabs({ active }: { active: "minor" | "intermediate" | "major" }) {
  const items = [
    { key: "minor" as const, label: "Talent", href: "/rounds/minor" },
    { key: "intermediate" as const, label: "Intermediate", href: "/rounds/advanced?round=intermediate" },
    { key: "major" as const, label: "Major", href: "/rounds/advanced?round=major" },
  ];

  return (
    <div className="sticky top-16 z-20 border-b border-primary/12 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl gap-1 px-4 py-3 sm:px-6">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              item.key === active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
