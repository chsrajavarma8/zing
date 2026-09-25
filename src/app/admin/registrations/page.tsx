import { canManage, getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/date";
import { parsePageParam } from "@/lib/pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { Team } from "@/types/database";
import { matchingTeamIds, parseRegistrationFilter } from "@/lib/admin/registration-filters";
import { RegistrationsTable } from "@/components/admin/registrations-table";
import { CopyContactsButtons } from "@/components/admin/copy-contacts-buttons";

const PAGE_SIZE = 25;

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const sp = await searchParams;
  const { q, status } = parseRegistrationFilter(sp);
  const page = parsePageParam(sp.page);

  const supabase = await createClient();
  const search = await matchingTeamIds(supabase, ctx.event.id, q);
  let query = supabase
    .from("teams")
    .select("*", { count: "exact" })
    .eq("event_id", ctx.event.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  // Matches team name/reference, or any member's name, email, phone or reference.
  if (search.ids) query = query.in("id", search.ids.length > 0 ? search.ids : ["00000000-0000-0000-0000-000000000000"]);
  if (status !== "all") query = query.eq("status", status);

  const { data: teams, count, error: queryError } = await query;
  const teamsError = queryError ?? (search.error ? { code: "search", message: "team search failed" } : null);
  const teamList = (teams as unknown as Team[] | null) ?? [];

  // A failed query must never render as "0 teams registered" (BUG-029).
  // PGRST103 = requested page is past the end: show an empty page, not an error.
  const outOfRange = teamsError?.code === "PGRST103";
  if (teamsError && !outOfRange) {
    console.error("[admin/registrations] failed to load teams:", teamsError.code, teamsError.message);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Registrations</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t load registrations</AlertTitle>
          <AlertDescription>
            Please refresh the page. If this keeps happening, contact support.{" "}
            <Link href="/admin/registrations" className="underline underline-offset-4">
              Reset filters
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const teamIds = teamList.map((t) => t.id);
  const { data: memberCounts } =
    teamIds.length > 0
      ? await supabase.from("team_members").select("team_id, verification_status").in("team_id", teamIds)
      : { data: [] as { team_id: string; verification_status: string }[] };

  const countsByTeam = new Map<string, { total: number; verified: number }>();
  for (const m of (memberCounts as unknown as { team_id: string; verification_status: string }[] | null) ?? []) {
    const c = countsByTeam.get(m.team_id) ?? { total: 0, verified: 0 };
    c.total++;
    if (m.verification_status === "verified") c.verified++;
    countsByTeam.set(m.team_id, c);
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const filterQuery = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(status !== "all" ? { status } : {}),
  }).toString();
  const filtered = filterQuery !== "";
  const exportHref = (format?: "contacts") => {
    const params = new URLSearchParams(filterQuery);
    if (format) params.set("format", format);
    const qs = params.toString();
    return `/api/admin/export/registrations${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Registrations</h1>
          <p className="text-muted-foreground">
            {count ?? 0} {filtered ? "teams match your filters" : "teams registered"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyContactsButtons eventId={ctx.event.id} q={q} status={status} />
          <Button variant="outline" asChild>
            <a href={exportHref("contacts")}>
              <Download className="h-4 w-4" /> Contacts CSV
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={exportHref()}>
              <Download className="h-4 w-4" /> Full CSV
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="mb-4 flex flex-wrap gap-2" method="get">
            <div className="relative flex-1 min-w-48">
              <label htmlFor="registrations-search" className="sr-only">
                Search teams or participants
              </label>
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input id="registrations-search" name="q" defaultValue={q} placeholder="Search team, name, email, phone or reference…" className="pl-8" />
            </div>
            <label htmlFor="registrations-status" className="sr-only">
              Filter by status
            </label>
            <select id="registrations-status" name="status" defaultValue={status} className="rounded-md border bg-background px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="disqualified">Disqualified</option>
            </select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>

          {filtered && (
            <p className="mb-3 text-xs text-muted-foreground">
              Copy and CSV buttons use these filters (all pages).{" "}
              <Link href="/admin/registrations" className="underline underline-offset-4">
                Clear filters
              </Link>
            </p>
          )}

          <RegistrationsTable
            eventId={ctx.event.id}
            canManage={canManage(ctx)}
            emptyMessage={outOfRange ? "This page is past the end of the results." : "No teams match your filters."}
            rows={teamList.map((t) => {
              const c = countsByTeam.get(t.id) ?? { total: 0, verified: 0 };
              return {
                id: t.id,
                teamName: t.team_name,
                referenceId: t.reference_id,
                status: t.status,
                registeredAt: formatDate(t.created_at),
                verifiedMembers: c.verified,
                totalMembers: c.total,
                incomplete: c.total < ctx.event.team_size_min,
              };
            })}
          />

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/admin/registrations?${new URLSearchParams({ q, status, page: String(p) }).toString()}`}
                  aria-current={p === page ? "page" : undefined}
                  className={`rounded-md px-3 py-1 text-sm ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
