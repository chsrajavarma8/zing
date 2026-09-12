"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteAdmin, revokeEventAdmin } from "@/app/admin/roles/actions";
import { useRouter } from "next/navigation";

interface Admin {
  id: string;
  role: string;
  profiles: { full_name: string | null; email: string } | null;
}
interface Invite {
  id: string;
  email: string;
  role: string;
  invited_at: string;
}

export function RolesManager({ eventId, admins, pendingInvites }: { eventId: string; admins: Admin[]; pendingInvites: Invite[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"event_admin" | "reviewer">("event_admin");
  const [setPasswordNow, setSetPasswordNow] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite() {
    if (!email.trim()) return;
    if (setPasswordNow && password.trim().length < 8) {
      toast.error("Initial password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const result = await inviteAdmin(eventId, email, role, setPasswordNow ? password : undefined);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not invite.");
      return;
    }
    toast.success(
      setPasswordNow
        ? "Account created. They can sign in with the password you set and will be asked to change it."
        : "Invite created: they'll be granted access on first sign-in.",
    );
    setEmail("");
    setPassword("");
    setSetPasswordNow(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite an admin or reviewer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="w-64" placeholder="person@example.com" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as "event_admin" | "reviewer")}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event_admin">Event admin</SelectItem>
                  <SelectItem value="reviewer">Reviewer / judge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="setPasswordNow" checked={setPasswordNow} onCheckedChange={(v) => setSetPasswordNow(Boolean(v))} />
            <Label htmlFor="setPasswordNow" className="font-normal">
              Set an initial password now instead of emailing a setup link
            </Label>
          </div>

          {setPasswordNow && (
            <div className="max-w-xs space-y-2">
              <label className="text-xs text-muted-foreground">Initial password</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              <p className="text-xs text-muted-foreground">
                They can sign in with exactly this password right away and must set their own private password on
                first login.
              </p>
            </div>
          )}

          <Button onClick={invite} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {setPasswordNow ? "Create account" : "Send invite"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current admins & reviewers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {admins.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{a.profiles?.full_name || a.profiles?.email}</p>
                <p className="text-muted-foreground">{a.profiles?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{a.role.replace("_", " ")}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Revoke access for ${a.profiles?.full_name || a.profiles?.email}`}
                  onClick={async () => {
                    const result = await revokeEventAdmin(a.id, eventId);
                    if (!result.ok) toast.error(result.error ?? "Could not revoke.");
                    else {
                      toast.success("Access revoked");
                      router.refresh();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {admins.length === 0 && <p className="text-muted-foreground">No admins assigned yet.</p>}
        </CardContent>
      </Card>

      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{inv.email}</span>
                <Badge variant="outline" className="capitalize">{inv.role.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
