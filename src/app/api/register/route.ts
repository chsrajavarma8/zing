import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrationSchema } from "@/lib/validations/registration";
import { provisionParticipantAccount } from "@/lib/auth/participant-provisioning";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = rateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429 },
    );
  }

  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const parsed = registrationSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.data ? [] : parsed.error.flatten() },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: event, error: eventError } = await admin
    .from("events")
    .select(
      "id, status, team_size_min, team_size_max, registration_open_at, registration_close_at, allow_gender_field, gender_field_required, name",
    )
    .eq("id", input.eventId)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const e = event as unknown as {
    id: string;
    status: string;
    team_size_min: number;
    team_size_max: number;
    registration_open_at: string | null;
    registration_close_at: string | null;
    gender_field_required: boolean;
    name: string;
  };

  if (e.status !== "published") {
    return NextResponse.json({ error: "Registration is not open for this event." }, { status: 403 });
  }

  const now = Date.now();
  if (e.registration_open_at && now < Date.parse(e.registration_open_at)) {
    return NextResponse.json({ error: "Registration has not opened yet." }, { status: 403 });
  }
  if (e.registration_close_at && now > Date.parse(e.registration_close_at)) {
    return NextResponse.json({ error: "Registration has closed." }, { status: 403 });
  }

  if (input.members.length < e.team_size_min || input.members.length > e.team_size_max) {
    return NextResponse.json(
      { error: `Team size must be between ${e.team_size_min} and ${e.team_size_max}.` },
      { status: 422 },
    );
  }

  if (e.gender_field_required && input.members.some((m) => !m.gender)) {
    return NextResponse.json({ error: "Gender is required for all members for this event." }, { status: 422 });
  }

  // Friendly pre-check ahead of the DB's own unique constraints (which remain
  // the source of truth under concurrent submissions).
  const emails = input.members.map((m) => m.email.toLowerCase());
  const { data: dupeEmails } = await admin
    .from("team_members")
    .select("email")
    .eq("event_id", input.eventId)
    .in("email", emails);

  if (dupeEmails && dupeEmails.length > 0) {
    return NextResponse.json(
      {
        error:
          "This email is already registered for this event. If this is your team, sign in instead of registering again — each member signs in individually with their own email.",
      },
      { status: 409 },
    );
  }

  const { data: currentPolicies } = await admin
    .from("policy_versions")
    .select("id, type")
    .eq("event_id", input.eventId)
    .eq("is_current", true);

  const privacyPolicy = (currentPolicies as { id: string; type: string }[] | null)?.find((p) => p.type === "privacy");
  const termsPolicy = (currentPolicies as { id: string; type: string }[] | null)?.find((p) => p.type === "terms");

  const { data: team, error: teamError } = await admin
    .from("teams")
    .insert({ event_id: input.eventId, team_name: input.teamName, extra_fields: input.extraFields, status: "pending" })
    .select("id, reference_id")
    .single();

  if (teamError || !team) {
    return NextResponse.json({ error: "Could not create team. Please try again." }, { status: 500 });
  }

  const teamRow = team as unknown as { id: string; reference_id: string };

  const memberRows = input.members.map((m) => ({
    event_id: input.eventId,
    team_id: teamRow.id,
    role: m.role,
    full_name: m.fullName,
    date_of_birth: m.dateOfBirth,
    college: m.college,
    roll_number: m.rollNumber,
    email: m.email.toLowerCase(),
    mobile: m.mobile,
    whatsapp: m.whatsappSameAsMobile ? m.mobile : m.whatsapp,
    whatsapp_same_as_mobile: m.whatsappSameAsMobile,
    gender: m.gender || null,
    consent_accepted: true,
    privacy_policy_version_id: privacyPolicy?.id ?? null,
    terms_version_id: termsPolicy?.id ?? null,
    communication_consent_essential: true,
    communication_consent_promotional: input.promotionalConsent,
  }));

  const { data: insertedMembers, error: membersError } = await admin
    .from("team_members")
    .insert(memberRows)
    .select("id, email, full_name, role, reference_id, date_of_birth");

  if (membersError || !insertedMembers) {
    // Roll back the team so we don't leave an orphaned, memberless team behind.
    await admin.from("teams").delete().eq("id", teamRow.id);
    const msg = membersError?.message?.includes("duplicate")
      ? "One or more emails or roll numbers are already registered for this event."
      : "Could not register team members. Please try again.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const members = insertedMembers as unknown as {
    id: string;
    email: string;
    full_name: string;
    role: string;
    reference_id: string;
    date_of_birth: string;
  }[];

  for (const member of members) {
    await admin.from("consents").insert([
      { team_member_id: member.id, consent_type: "privacy_policy", accepted: true, policy_version_id: privacyPolicy?.id ?? null },
      { team_member_id: member.id, consent_type: "terms", accepted: true, policy_version_id: termsPolicy?.id ?? null },
      { team_member_id: member.id, consent_type: "essential_communication", accepted: true },
      { team_member_id: member.id, consent_type: "promotional_communication", accepted: input.promotionalConsent },
    ]);
  }

  const lead = members.find((m) => m.role === "lead");

  // Account creation happens synchronously here, server-side only, using a
  // deterministic temporary password - no email of any kind is sent as part
  // of registration. Each participant computes their own temporary password
  // from details only they (and whoever filled in this form) know; see the
  // "First-time login instructions" on the sign-in page.
  const provisionResults = await Promise.all(
    members.map((m) =>
      provisionParticipantAccount({
        email: m.email,
        teamName: input.teamName,
        fullName: m.full_name,
        dateOfBirth: m.date_of_birth,
      }),
    ),
  );

  // Only a brand-new account gets linked immediately - if the email already
  // belongs to someone else's existing account, it's linked later, only once
  // that account's real owner proves ownership by signing in with their own
  // password (see the link-sweep in src/app/login/actions.ts).
  await Promise.all(
    provisionResults.map((outcome, i) =>
      outcome.status === "created"
        ? admin.from("team_members").update({ profile_id: outcome.profileId }).eq("id", members[i].id)
        : Promise.resolve(),
    ),
  );

  return NextResponse.json({
    team: { id: teamRow.id, referenceId: teamRow.reference_id, name: input.teamName },
    members: members.map((m, i) => ({
      referenceId: m.reference_id,
      email: m.email,
      fullName: m.full_name,
      role: m.role,
      accountReady: provisionResults[i].status !== "failed",
    })),
    leadEmail: lead?.email,
  });
}
