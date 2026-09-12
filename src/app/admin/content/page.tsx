import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FaqEditor } from "@/components/admin/faq-editor";
import { AnnouncementsEditor } from "@/components/admin/announcements-editor";
import { PolicyEditor } from "@/components/admin/policy-editor";
import type { Faq, Announcement } from "@/types/database";

export default async function AdminContentPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const [{ data: faqs }, { data: announcements }, { data: policies }] = await Promise.all([
    supabase.from("faqs").select("*").eq("event_id", ctx.event.id).order("order_index"),
    supabase.from("announcements").select("*").eq("event_id", ctx.event.id).order("created_at", { ascending: false }),
    supabase.from("policy_versions").select("*").eq("event_id", ctx.event.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content & Policies</h1>
        <p className="text-muted-foreground">FAQs, announcements, and legal documents.</p>
      </div>

      <Tabs defaultValue="faq">
        <TabsList className="flex-wrap">
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="policies">Privacy & Terms</TabsTrigger>
        </TabsList>
        <TabsContent value="faq">
          <FaqEditor eventId={ctx.event.id} faqs={(faqs as unknown as Faq[] | null) ?? []} />
        </TabsContent>
        <TabsContent value="announcements">
          <AnnouncementsEditor eventId={ctx.event.id} announcements={(announcements as unknown as Announcement[] | null) ?? []} />
        </TabsContent>
        <TabsContent value="policies">
          <PolicyEditor
            eventId={ctx.event.id}
            policies={
              (policies as unknown as { id: string; type: string; version: string; content_markdown: string; is_current: boolean; published_at: string | null }[] | null) ?? []
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
