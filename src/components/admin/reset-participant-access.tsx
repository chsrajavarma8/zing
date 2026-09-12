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
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resetParticipantAccess } from "@/app/admin/registrations/[teamId]/actions";

export function ResetParticipantAccess({ teamMemberId, eventId }: { teamMemberId: string; eventId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
          Reset access
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset this participant&apos;s access?</AlertDialogTitle>
          <AlertDialogDescription>
            Only do this after verifying their identity yourself (support email/phone, not just their date of
            birth or team name). This regenerates their temporary password from the same formula shown on the
            sign-in page and requires them to set a new private password on next sign-in. It never affects admin
            accounts.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const result = await resetParticipantAccess(teamMemberId, eventId);
                if (!result.ok) toast.error(result.error ?? "Could not reset access.");
                else toast.success("Access reset: they can sign in with the standard temporary-password formula.");
              })
            }
          >
            Reset access
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
