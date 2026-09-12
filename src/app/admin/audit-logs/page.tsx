import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/date";

const PAGE_SIZE = 50;

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));

  const supabase = await createClient();
  const { data: logs, count } = await supabase
    .from("audit_logs")
    .select("*, profiles(full_name, email)", { count: "exact" })
    .eq("event_id", ctx.event.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">{count ?? 0} recorded actions for this event.</p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs as unknown as
                | { id: string; created_at: string; action: string; entity_type: string; entity_id: string | null; profiles: { full_name: string | null; email: string } | null }[]
                | null
              )?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(l.created_at)}</TableCell>
                  <TableCell className="text-sm">{l.profiles?.full_name || l.profiles?.email || "System"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.action}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {l.entity_type}
                    {l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(!logs || logs.length === 0) && <p className="py-8 text-center text-muted-foreground">No audit entries yet.</p>}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`/admin/audit-logs?page=${p}`}
                  className={`rounded-md px-3 py-1 text-sm ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
