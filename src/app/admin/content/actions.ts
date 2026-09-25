"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/admin-guards";
import { revalidatePath } from "next/cache";

// Content editing is an event_admin/super_admin capability; reviewers get a
// read-only view (BUG-020). Every write is scoped to the admin's event and
// must affect exactly one row to count as success (BUG-011).

type Result = { ok: true } | { ok: false; error: string };

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

export async function upsertFaq(
  eventId: string,
  input: { id?: string; question: string; answer: string; orderIndex: number; published: boolean },
): Promise<Result> {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;

  const question = text(input.question, 500);
  const answer = text(input.answer, 5000);
  if (!question || !answer) return { ok: false, error: "Enter a question and an answer." };

  const supabase = await createClient();
  const payload = {
    event_id: eventId,
    question,
    answer,
    order_index: Number.isFinite(input.orderIndex) ? Math.trunc(input.orderIndex) : 0,
    published: Boolean(input.published),
  };
  const { data, error } = input.id
    ? await supabase.from("faqs").update(payload).eq("id", input.id).eq("event_id", eventId).select("id")
    : await supabase.from("faqs").insert(payload).select("id");
  if (error || !data || data.length !== 1) return { ok: false, error: "Could not save FAQ." };

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: input.id ? "update_faq" : "create_faq", entityType: "faqs", entityId: data[0].id as string });
  revalidatePath("/admin/content");
  revalidatePath("/faq");
  return { ok: true };
}

export async function deleteFaq(eventId: string, id: string): Promise<Result> {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase.from("faqs").delete().eq("id", id).eq("event_id", eventId).select("id");
  if (error || !data || data.length !== 1) return { ok: false, error: "Could not delete this FAQ." };

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "delete_faq", entityType: "faqs", entityId: id });
  revalidatePath("/admin/content");
  revalidatePath("/faq");
  return { ok: true };
}

export async function upsertAnnouncement(
  eventId: string,
  input: { id?: string; title: string; body: string; isPinned: boolean; published: boolean },
): Promise<Result> {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;

  const title = text(input.title, 300);
  const body = text(input.body, 10000);
  if (!title || !body) return { ok: false, error: "Enter a title and a message." };

  const supabase = await createClient();
  const payload = {
    event_id: eventId,
    title,
    body,
    is_pinned: Boolean(input.isPinned),
    published_at: input.published ? new Date().toISOString() : null,
    created_by: guard.ctx.user.userId,
  };
  const { data, error } = input.id
    ? await supabase.from("announcements").update(payload).eq("id", input.id).eq("event_id", eventId).select("id")
    : await supabase.from("announcements").insert(payload).select("id");
  if (error || !data || data.length !== 1) return { ok: false, error: "Could not save announcement." };

  await logAudit({
    actorProfileId: guard.ctx.user.userId,
    eventId,
    action: input.id ? "update_announcement" : "create_announcement",
    entityType: "announcements",
    entityId: data[0].id as string,
  });
  revalidatePath("/admin/content");
  revalidatePath("/announcements");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAnnouncement(eventId: string, id: string): Promise<Result> {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").delete().eq("id", id).eq("event_id", eventId).select("id");
  if (error || !data || data.length !== 1) return { ok: false, error: "Could not delete this announcement." };

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "delete_announcement", entityType: "announcements", entityId: id });
  revalidatePath("/admin/content");
  revalidatePath("/announcements");
  revalidatePath("/");
  return { ok: true };
}

// BUG-012: publication is one atomic, serialized database operation
// (publish_policy_version, 0043). A duplicate label or any other failure
// leaves the currently published version untouched.
export async function publishPolicyVersion(
  eventId: string,
  type: "privacy" | "terms" | "rules",
  version: string,
  contentMarkdown: string,
): Promise<Result> {
  const guard = await requireManager(eventId);
  if (!guard.ok) return guard;

  if (typeof contentMarkdown !== "string" || contentMarkdown.length > 200_000) {
    return { ok: false, error: "The policy text is too long." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_policy_version", {
    p_event_id: eventId,
    p_type: type,
    p_version: version,
    p_content: contentMarkdown,
  });
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "That version label is already used." };
    if (error?.code === "22023" && error.message) return { ok: false, error: error.message };
    return { ok: false, error: "Could not publish. The current version is unchanged." };
  }

  await logAudit({ actorProfileId: guard.ctx.user.userId, eventId, action: "publish_policy", entityType: "policy_versions", entityId: data as string, after: { type, version } });
  revalidatePath("/admin/content");
  revalidatePath(`/${type}`);
  return { ok: true };
}
