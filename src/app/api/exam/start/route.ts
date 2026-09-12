import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { examId } = await req.json().catch(() => ({ examId: null }));
  if (!examId) return NextResponse.json({ error: "Missing examId." }, { status: 400 });

  const admin = createAdminClient();

  const { data: exam } = await admin.from("exams").select("*, rounds(event_id)").eq("id", examId).maybeSingle();
  const examRow = exam as unknown as {
    id: string;
    round_id: string;
    starts_at: string;
    ends_at: string;
    duration_minutes: number;
    status: string;
    rounds: { event_id: string } | null;
  } | null;

  if (!examRow || !examRow.rounds) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const { data: member } = await admin
    .from("team_members")
    .select("id, verification_status")
    .eq("event_id", examRow.rounds.event_id)
    .eq("profile_id", user.id)
    .maybeSingle();

  const memberRow = member as unknown as { id: string; verification_status: string } | null;
  if (!memberRow) return NextResponse.json({ error: "You're not registered for this event." }, { status: 403 });

  // Fail closed: an unreadable profile is treated as still restricted, not
  // as cleared. Checked directly (not only via team_members.verification_status,
  // which mirrors it) as the server-side boundary the mandatory
  // password-change gate needs - the portal layout redirect alone only
  // stops page navigation, not a direct call to this route.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("must_change_password")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile || (profile as { must_change_password: boolean }).must_change_password) {
    return NextResponse.json({ error: "Finish setting up your account (sign in and set your password) before starting the exam." }, { status: 403 });
  }
  if (memberRow.verification_status !== "verified") {
    return NextResponse.json({ error: "Finish setting up your account (sign in and set your password) before starting the exam." }, { status: 403 });
  }

  const now = Date.now();
  if (now < Date.parse(examRow.starts_at)) {
    return NextResponse.json({ error: "This exam hasn't opened yet." }, { status: 403 });
  }
  if (now > Date.parse(examRow.ends_at)) {
    return NextResponse.json({ error: "This exam's window has closed." }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("exam_attempts")
    .select("id, expires_at, status")
    .eq("exam_id", examId)
    .eq("team_member_id", memberRow.id)
    .maybeSingle();

  const existingAttempt = existing as unknown as { id: string; expires_at: string; status: string } | null;
  if (existingAttempt) {
    if (existingAttempt.status !== "in_progress") {
      return NextResponse.json({ error: "You've already submitted this exam." }, { status: 409 });
    }
    return NextResponse.json({ attemptId: existingAttempt.id, expiresAt: existingAttempt.expires_at });
  }

  const expiresAt = new Date(
    Math.min(now + examRow.duration_minutes * 60_000, Date.parse(examRow.ends_at)),
  ).toISOString();

  const { data: attempt, error } = await admin
    .from("exam_attempts")
    .insert({ exam_id: examId, team_member_id: memberRow.id, expires_at: expiresAt })
    .select("id, expires_at")
    .single();

  if (error || !attempt) {
    return NextResponse.json({ error: "Could not start the exam. Please try again." }, { status: 500 });
  }

  const attemptRow = attempt as unknown as { id: string; expires_at: string };
  return NextResponse.json({ attemptId: attemptRow.id, expiresAt: attemptRow.expires_at });
}
