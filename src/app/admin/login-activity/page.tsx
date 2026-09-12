import { getAdminContext, canManage } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/date";

const PAGE_SIZE = 50;

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  invalid_credentials: "destructive",
  rate_limited: "secondary",
};

const OUTCOME_LABEL: Record<string, string> = {
  success: "Success",
  invalid_credentials: "Invalid credentials",
  rate_limited: "Rate limited",
};

export default async function LoginActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; outcome?: string; role?: string; page?: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) return null;

  // Login activity is intentionally restricted to actual administrators
  // (super admin / event admin), not reviewers - matches login_activity_select
  // in 0024_login_activity.sql. Enforced here too, not only by RLS.
  if (!canManage(ctx)) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
          <ShieldAlert className="h-5 w-5" /> You don&apos;t have access to login activity.
        </CardContent>
      </Card>
    );
  }

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const outcome = sp.outcome ?? "all";
  const role = sp.role ?? "all";
  const page = Math.max(1, Number(sp.page ?? 1));

  const supabase = await createClient();
  let query = supabase
    .from("login_activity")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("attempted_email", `%${q}%`);
  if (outcome !== "all") query = query.eq("outcome", outcome);
  if (role !== "all") query = query.eq("role", role);

  const { data: entries, count } = await query;

  type Entry = {
    id: string;
    attempted_email: string;
    role: string;
    outcome: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
  };
  const entryList = (entries as unknown as Entry[] | null) ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Login Activity</h1>
        <p className="text-muted-foreground">{count ?? 0} recorded sign-in attempts, all account types.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="mb-4 flex flex-wrap gap-2" method="get">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="Search email…" className="pl-8" />
            </div>
            <select name="outcome" defaultValue={outcome} className="rounded-md border bg-background px-3 py-2 text-sm">
              <option value="all">All outcomes</option>
              <option value="success">Success</option>
              <option value="invalid_credentials">Invalid credentials</option>
              <option value="rate_limited">Rate limited</option>
            </select>
            <select name="role" defaultValue={role} className="rounded-md border bg-background px-3 py-2 text-sm">
              <option value="all">All roles</option>
              <option value="participant">Participant</option>
              <option value="team_lead">Team lead</option>
              <option value="event_admin">Event admin</option>
              <option value="reviewer">Judge / reviewer</option>
              <option value="super_admin">Super admin</option>
              <option value="unknown">Unknown</option>
            </select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>IP address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entryList.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(e.created_at)}</TableCell>
                    <TableCell className="text-sm">{e.attempted_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{e.role.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={OUTCOME_VARIANT[e.outcome] ?? "outline"}>{OUTCOME_LABEL[e.outcome] ?? e.outcome}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{e.ip_address ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {entryList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No login activity matches your filters.
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
                  href={`/admin/login-activity?q=${q}&outcome=${outcome}&role=${role}&page=${p}`}
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
