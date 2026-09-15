import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Every field here (full_name, college, roll_number, mobile, whatsapp,
// gender) is attacker-controlled - self-entered at public registration -
// and this CSV is meant to be opened in Excel/Sheets by an organizer. A
// value starting with =, +, -, @, tab, or CR is interpreted as a formula by
// most spreadsheet apps, which can run arbitrary commands or exfiltrate
// data via a crafted registration field ("CSV/formula injection"). Prefix
// with a literal quote to force those apps to treat it as plain text.
function csvEscape(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("team_members")
    .select("*, teams(team_name, reference_id, status)")
    .eq("event_id", ctx.event.id)
    .order("created_at");

  const rows = (members as unknown as Record<string, unknown>[] | null) ?? [];
  const headers = [
    "team_name",
    "team_reference_id",
    "team_status",
    "participant_reference_id",
    "role",
    "full_name",
    "date_of_birth",
    "education_level",
    "college",
    "roll_number",
    "class_grade",
    "email",
    "mobile",
    "whatsapp",
    "gender",
    "verification_status",
    "created_at",
  ];

  const lines = [headers.join(",")];
  for (const m of rows) {
    const team = m.teams as { team_name?: string; reference_id?: string; status?: string } | null;
    lines.push(
      [
        team?.team_name,
        team?.reference_id,
        team?.status,
        m.reference_id,
        m.role,
        m.full_name,
        m.date_of_birth,
        m.education_level,
        m.college,
        m.roll_number,
        m.class_grade,
        m.email,
        m.mobile,
        m.whatsapp,
        m.gender,
        m.verification_status,
        m.created_at,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  await logAudit({
    actorProfileId: ctx.user.userId,
    eventId: ctx.event.id,
    action: "export_registrations_csv",
    entityType: "team_members",
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="registrations-${ctx.event.slug}.csv"`,
    },
  });
}
