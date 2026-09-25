import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { loadFilteredMembers, parseRegistrationFilter, sortByTeam, teamNameOf } from "@/lib/admin/registration-filters";

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

// ?format=contacts gives just team / name / phone / email. ?q= and ?status=
// apply the same filter as the Registrations list, so the export matches
// what the admin is looking at.
export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const contactsOnly = params.get("format") === "contacts";
  const filter = parseRegistrationFilter({ q: params.get("q") ?? undefined, status: params.get("status") ?? undefined });
  const filtered = filter.q !== "" || filter.status !== "all";

  const { rows, error } = await loadFilteredMembers(createAdminClient(), ctx.event.id, filter);
  if (error) return NextResponse.json({ error: "Couldn't load registrations." }, { status: 500 });

  const suffix = `${ctx.event.slug}${filter.status !== "all" ? `-${filter.status}` : ""}${filter.q ? "-search" : ""}`;

  if (contactsOnly) {
    const lines = [["team_name", "full_name", "phone", "email"].join(",")];
    for (const m of sortByTeam(rows)) {
      lines.push([teamNameOf(m), m.full_name, m.mobile, m.email].map(csvEscape).join(","));
    }

    await logAudit({
      actorProfileId: ctx.user.userId,
      eventId: ctx.event.id,
      action: "export_registrations_contacts_csv",
      entityType: "team_members",
      after: filtered ? filter : undefined,
    });

    return csvResponse(lines, `registrations-contacts-${suffix}.csv`);
  }

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
    const team = m.teams;
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
    after: filtered ? filter : undefined,
  });

  return csvResponse(lines, `registrations-${suffix}.csv`);
}

// The UTF-8 BOM makes Excel read non-ASCII names correctly instead of as mojibake.
const BOM = "﻿";
const CRLF = "\r\n";

function csvResponse(lines: string[], filename: string) {
  return new NextResponse(BOM + lines.join(CRLF), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
