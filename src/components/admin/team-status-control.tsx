"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { setTeamStatus } from "@/app/admin/registrations/[teamId]/actions";

export function TeamStatusControl({ teamId, eventId, status }: { teamId: string; eventId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={isPending}
      onValueChange={(v) =>
        startTransition(async () => {
          const result = await setTeamStatus(teamId, eventId, v as "pending" | "verified" | "disqualified");
          if (!result.ok) toast.error(result.error ?? "Could not update status.");
          else toast.success("Status updated");
        })
      }
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="verified">Verified</SelectItem>
        <SelectItem value="disqualified">Disqualified</SelectItem>
      </SelectContent>
    </Select>
  );
}
