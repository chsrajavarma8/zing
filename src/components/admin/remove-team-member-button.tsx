"use client";

import { useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { removeTeamMemberByAdmin } from "@/app/admin/registrations/[teamId]/actions";

export function RemoveTeamMemberButton({ teamMemberId, eventId, fullName }: { teamMemberId: string; eventId: string; fullName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {fullName} from this team?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes their registration record for this event and disconnects their account from this team.
            Their account itself is not deleted. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() =>
              startTransition(async () => {
                const result = await removeTeamMemberByAdmin(teamMemberId, eventId);
                if (!result.ok) toast.error(result.error ?? "Could not remove member.");
                else toast.success("Member removed");
              })
            }
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
