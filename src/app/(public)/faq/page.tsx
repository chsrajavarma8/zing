import { getPublicEvent } from "@/lib/events";
import { EventNotConfigured } from "@/components/site/event-not-configured";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/site/page-header";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Reveal } from "@/components/motion/reveal";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "FAQ",
  description: "Answers to common questions about registering, signing in, and participating in Zing Hackathon by Skillglider.",
  path: "/faq",
});

export default async function FaqPage() {
  const event = await getPublicEvent();
  if (!event) return <EventNotConfigured />;

  const supabase = await createClient();
  const { data: faqs } = await supabase
    .from("faqs")
    .select("*")
    .eq("event_id", event.id)
    .eq("published", true)
    .order("order_index");

  const list = (faqs as unknown as { id: string; question: string; answer: string }[] | null) ?? [];

  return (
    <main>
      <PageHeader eyebrow="Questions?" title="Questions before you begin?" />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {list.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No FAQs published yet. Reach out via the{" "}
            <a href="/contact" className="text-primary underline underline-offset-4">
              contact page
            </a>
            .
          </p>
        ) : (
          <Reveal>
            <Accordion type="single" collapsible className="w-full divide-y divide-primary/12 rounded-2xl border border-primary/12 bg-cream px-2 sm:px-4">
              {list.map((faq, i) => (
                <AccordionItem key={faq.id} value={faq.id} className="border-b-0">
                  <AccordionTrigger className="gap-4 py-6 text-left text-lg font-medium hover:no-underline">
                    <span className="flex items-start gap-4">
                      <span className="font-heading text-sm font-bold text-rose">{String(i + 1).padStart(2, "0")}</span>
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pl-9 text-base text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        )}
      </div>
    </main>
  );
}
