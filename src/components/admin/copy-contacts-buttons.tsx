"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { getRegistrationContacts } from "@/app/admin/registrations/actions";

type Kind = "email" | "phone";
type Result = Awaited<ReturnType<typeof getRegistrationContacts>>;

const LABEL: Record<Kind, string> = { email: "emails", phone: "phone numbers" };

// Copies every email / phone of the teams matching the current filter.
export function CopyContactsButtons({ eventId, q, status }: { eventId: string; q: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Kind | null>(null);
  const [manual, setManual] = useState<{ kind: Kind; text: string } | null>(null);

  function copy(kind: Kind) {
    setBusy(kind);
    const request = getRegistrationContacts(eventId, q, status, kind);

    startTransition(async () => {
      let result: Result;
      try {
        // Safari only allows clipboard writes started inside the click
        // handler, so hand it a ClipboardItem whose content resolves once the
        // server responds. Other browsers take the same path.
        const text = request.then((r) => {
          if (!r.ok || r.count === 0) throw new Error("nothing to copy");
          return new Blob([r.text], { type: "text/plain" });
        });
        const write =
          typeof ClipboardItem !== "undefined" && navigator.clipboard?.write
            ? navigator.clipboard.write([new ClipboardItem({ "text/plain": text })])
            : request.then((r) => (r.ok && r.count > 0 ? navigator.clipboard.writeText(r.text) : undefined));
        // Nothing awaits `write` on the early returns below.
        write.catch(() => {});
        result = await request;
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.count === 0) {
          toast.info(`No ${LABEL[kind]} match the current filter.`);
          return;
        }
        await write;
        toast.success(`Copied ${result.count} ${LABEL[kind]}`);
      } catch {
        const r = await request.catch(() => null);
        if (r?.ok && r.count > 0) setManual({ kind, text: r.text });
        else toast.error(r && !r.ok ? r.error : `Couldn't copy ${LABEL[kind]}.`);
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <>
      <Button variant="outline" disabled={isPending} onClick={() => copy("email")}>
        {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Copy emails
      </Button>
      <Button variant="outline" disabled={isPending} onClick={() => copy("phone")}>
        {busy === "phone" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Copy phones
      </Button>

      <Dialog open={manual !== null} onOpenChange={(open) => !open && setManual(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy {manual ? LABEL[manual.kind] : ""}</DialogTitle>
            <DialogDescription>Your browser blocked automatic copying. Select all the text below and copy it.</DialogDescription>
          </DialogHeader>
          <Textarea readOnly rows={8} value={manual?.text ?? ""} onFocus={(e) => e.currentTarget.select()} autoFocus />
        </DialogContent>
      </Dialog>
    </>
  );
}
