import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { FaqEditor } from "@/components/admin/faq-editor";
import { AnnouncementsEditor } from "@/components/admin/announcements-editor";
import { PolicyEditor } from "@/components/admin/policy-editor";
import { formatDate } from "@/lib/date";
import type { Faq, Announcement } from "@/types/database";

type PolicyRow = { id: string; type: string; version: string; content_markdown: string; is_current: boolean; published_at: string | null };

export default async function AdminContentPage() {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const manage = canManage(ctx);

  const supabase = await createClient();
  const [{ data: faqs }, { data: announcements }, { data: policies }] = await Promise.all([
    supabase.from("faqs").select("*").eq("event_id", ctx.event.id).order("order_index"),
    supabase.from("announcements").select("*").eq("event_id", ctx.event.id).order("created_at", { ascending: false }),
    supabase.from("policy_versions").select("*").eq("event_id", ctx.event.id).order("created_at", { ascending: false }),
  ]);

  const faqList = (faqs as unknown as Faq[] | null) ?? [];
  const announcementList = (announcements as unknown as Announcement[] | null) ?? [];
  const policyList = (policies as unknown as PolicyRow[] | null) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content & Policies</h1>
        <p className="text-muted-foreground">FAQs, announcements, and legal documents.</p>
      </div>

      {!manage && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>You have read-only access. Only event admins can edit content.</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="faq">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="policies">Privacy & Terms</TabsTrigger>
        </TabsList>
        <TabsContent value="faq">
          {manage ? (
            <FaqEditor eventId={ctx.event.id} faqs={faqList} />
          ) : (
            <div className="space-y-3">
              {faqList.map((f) => (
                <Card key={f.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{f.question}</CardTitle>
                    {!f.published && <CardDescription>Unpublished</CardDescription>}
                  </CardHeader>
                  <CardContent className="whitespace-pre-wrap text-sm">{f.answer}</CardContent>
                </Card>
              ))}
              {faqList.length === 0 && <p className="text-sm text-muted-foreground">No FAQs yet.</p>}
            </div>
          )}
        </TabsContent>
        <TabsContent value="announcements">
          {manage ? (
            <AnnouncementsEditor eventId={ctx.event.id} announcements={announcementList} />
          ) : (
            <div className="space-y-3">
              {announcementList.map((a) => (
                <Card key={a.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <CardDescription>{a.published_at ? `Published ${formatDate(a.published_at)}` : "Draft"}</CardDescription>
                  </CardHeader>
                  <CardContent className="whitespace-pre-wrap text-sm">{a.body}</CardContent>
                </Card>
              ))}
              {announcementList.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
            </div>
          )}
        </TabsContent>
        <TabsContent value="policies">
          {manage ? (
            <PolicyEditor eventId={ctx.event.id} policies={policyList} />
          ) : (
            <div className="space-y-3">
              {policyList
                .filter((p) => p.is_current)
                .map((p) => (
                  <Card key={p.id}>
                    <CardHeader className="flex-row items-center gap-2 space-y-0">
                      <CardTitle className="text-base capitalize">{p.type}</CardTitle>
                      <Badge variant="outline">{p.version}</Badge>
                    </CardHeader>
                    <CardContent className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm">{p.content_markdown}</CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
