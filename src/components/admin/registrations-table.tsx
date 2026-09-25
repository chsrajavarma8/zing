"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setTeamsStatus } from "@/app/admin/registrations/actions";

export interface RegistrationRow {
  id: string;
  teamName: string;
  referenceId: string;
  status: "pending" | "verified" | "disqualified";
  registeredAt: string;
  verifiedMembers: number;
  totalMembers: number;
  incomplete: boolean;
}

type Status = RegistrationRow["status"];

export function RegistrationsTable({
  rows,
  eventId,
  canManage,
  emptyMessage,
}: {
  rows: RegistrationRow[];
  eventId: string;
  canManage: boolean;
  emptyMessage: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDisqualify, setConfirmDisqualify] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Drop selections for teams no longer on this page (after filtering or paging).
  const visibleSelected = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allSelected = rows.length > 0 && visibleSelected.length === rows.length;

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function apply(status: Status) {
    const ids = visibleSelected;
    startTransition(async () => {
      const result = await setTeamsStatus(ids, eventId, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.updated} team${result.updated === 1 ? "" : "s"} marked ${status}`);
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-3">
      {canManage && visibleSelected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{visibleSelected.length} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" disabled={isPending} onClick={() => apply("verified")}>
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Verify
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => apply("pending")}>
              Mark pending
            </Button>
            <Button size="sm" variant="destructive" disabled={isPending} onClick={() => setConfirmDisqualify(true)}>
              Disqualify
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all teams on this page"
                    checked={allSelected ? true : visibleSelected.length > 0 ? "indeterminate" : false}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </TableHead>
              )}
              <TableHead>Team</TableHead>
              <TableHead>Reference ID</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id} data-state={selected.has(t.id) ? "selected" : undefined}>
                {canManage && (
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${t.teamName}`}
                      checked={selected.has(t.id)}
                      onCheckedChange={(v) => toggle(t.id, v === true)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Link href={`/admin/registrations/${t.id}`} className="font-medium hover:underline">
                    {t.teamName}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{t.referenceId}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {t.verifiedMembers}/{t.totalMembers} verified
                    {t.incomplete && <Badge variant="destructive">Incomplete</Badge>}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={t.status === "verified" ? "default" : t.status === "disqualified" ? "destructive" : "outline"}>
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.registeredAt}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={confirmDisqualify} onOpenChange={setConfirmDisqualify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disqualify {visibleSelected.length} team{visibleSelected.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be marked disqualified. You can change a team back to pending or verified later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => apply("disqualified")}
            >
              Disqualify
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
