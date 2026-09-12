"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function upsertFaq(eventId: string, input: { id?: string; question: string; answer: string; orderIndex: number; published: boolean }) {
  const supabase = await createClient();
  const payload = { event_id: eventId, question: input.question, answer: input.answer, order_index: input.orderIndex, published: input.published };
  const { error } = input.id
    ? await supabase.from("faqs").update(payload).eq("id", input.id)
    : await supabase.from("faqs").insert(payload);
  if (error) return { ok: false, error: "Could not save FAQ." };
  revalidatePath("/admin/content");
  revalidatePath("/faq");
  return { ok: true };
}

export async function deleteFaq(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete." };
  revalidatePath("/admin/content");
  revalidatePath("/faq");
  return { ok: true };
}

export async function upsertAnnouncement(eventId: string, input: { id?: string; title: string; body: string; isPinned: boolean; published: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const payload = {
    event_id: eventId,
    title: input.title,
    body: input.body,
    is_pinned: input.isPinned,
    published_at: input.published ? new Date().toISOString() : null,
    created_by: user.id,
  };
  const { error } = input.id
    ? await supabase.from("announcements").update(payload).eq("id", input.id)
    : await supabase.from("announcements").insert(payload);
  if (error) return { ok: false, error: "Could not save announcement." };
  revalidatePath("/admin/content");
  revalidatePath("/announcements");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAnnouncement(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete." };
  revalidatePath("/admin/content");
  revalidatePath("/announcements");
  return { ok: true };
}

export async function publishPolicyVersion(eventId: string, type: "privacy" | "terms" | "rules", version: string, contentMarkdown: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Unset the previous current version, then insert the new one as current.
  await supabase.from("policy_versions").update({ is_current: false }).eq("event_id", eventId).eq("type", type).eq("is_current", true);

  const { error } = await supabase.from("policy_versions").insert({
    event_id: eventId,
    type,
    version,
    content_markdown: contentMarkdown,
    is_current: true,
    published_at: new Date().toISOString(),
    created_by: user.id,
  });

  if (error) return { ok: false, error: error.message.includes("duplicate") ? "That version label is already used." : "Could not publish." };
  await logAudit({ actorProfileId: user.id, eventId, action: "publish_policy", entityType: "policy_versions", entityId: type, after: { version } });
  revalidatePath("/admin/content");
  revalidatePath(`/${type}`);
  return { ok: true };
}
