import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentBlocksEditor } from "@/components/admin/content-blocks-editor";
import { FaqEditor } from "@/components/admin/faq-editor";
import { AnnouncementsEditor } from "@/components/admin/announcements-editor";
import { PolicyEditor } from "@/components/admin/policy-editor";
import type { Faq, Announcement } from "@/types/database";

export default async function AdminContentPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const [{ data: blocks }, { data: faqs }, { data: announcements }, { data: policies }] = await Promise.all([
    supabase.from("content_blocks").select("*").eq("event_id", ctx.event.id),
    supabase.from("faqs").select("*").eq("event_id", ctx.event.id).order("order_index"),
    supabase.from("announcements").select("*").eq("event_id", ctx.event.id).order("created_at", { ascending: false }),
    supabase.from("policy_versions").select("*").eq("event_id", ctx.event.id).order("created_at", { ascending: false }),
  ]);

  const blockMap = new Map(((blocks as unknown as { key: string; content: Record<string, string> }[] | null) ?? []).map((b) => [b.key, b.content]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content & Policies</h1>
        <p className="text-muted-foreground">Homepage copy, FAQs, announcements, and legal documents.</p>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="flex-wrap">
          <TabsTrigger value="content">Homepage content</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="policies">Privacy & Terms</TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <ContentBlocksEditor eventId={ctx.event.id} blocks={blockMap} />
        </TabsContent>
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
