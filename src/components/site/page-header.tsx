import { Reveal } from "@/components/motion/reveal";

export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="relative overflow-hidden border-b border-primary/12 bg-cream">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24">
        <Reveal>
          {eyebrow && (
            <p className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-rose">
              <span className="h-px w-6 bg-rose" /> {eyebrow} <span className="h-px w-6 bg-rose" />
            </p>
          )}
          <h1 className="mt-3 text-balance font-heading text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          {description && <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground">{description}</p>}
        </Reveal>
      </div>
    </div>
  );
}
