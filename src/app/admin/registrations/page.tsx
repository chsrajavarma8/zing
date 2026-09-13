import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/date";
import type { Team } from "@/types/database";

const PAGE_SIZE = 25;

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "all";
  const page = Math.max(1, Number(sp.page ?? 1));

  const supabase = await createClient();
  let query = supabase
    .from("teams")
    .select("*", { count: "exact" })
    .eq("event_id", ctx.event.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("team_name", `%${q}%`);
  if (status !== "all") query = query.eq("status", status);

  const { data: teams, count } = await query;
  const teamList = (teams as unknown as Team[] | null) ?? [];

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Registrations</h1>
          <p className="text-muted-foreground">{count ?? 0} teams registered</p>
        </div>
        <Button variant="outline" asChild>
          <a href="/api/admin/export/registrations">
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="mb-4 flex flex-wrap gap-2" method="get">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="Search team name…" className="pl-8" />
            </div>
            <select name="status" defaultValue={status} className="rounded-md border bg-background px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="disqualified">Disqualified</option>
            </select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Reference ID</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamList.map((t) => {
                  const c = countsByTeam.get(t.id) ?? { total: 0, verified: 0 };
                  return (
                    <TableRow key={t.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/admin/registrations/${t.id}`} className="font-medium hover:underline">
                          {t.team_name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.reference_id}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {c.verified}/{c.total} verified
                          {c.total < ctx.event.team_size_min && <Badge variant="destructive">Incomplete</Badge>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status === "verified" ? "default" : t.status === "disqualified" ? "destructive" : "outline"}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
                {teamList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No teams match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/admin/registrations?q=${q}&status=${status}&page=${p}`}
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
