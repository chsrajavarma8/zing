"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, XCircle } from "lucide-react";
import { createLinkClient } from "@/lib/supabase/client";
import { completePasswordSetup } from "./actions";

type Status = "checking" | "ready" | "invalid" | "success";

export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [account, setAccount] = useState<{ id: string; email: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inviteToken = useRef<string | undefined>(undefined);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    inviteToken.current = search.get("invite") ?? undefined;

    const supabase = createLinkClient();
    const scrubUrl = () => {
      const keep = new URLSearchParams();
      if (inviteToken.current) keep.set("invite", inviteToken.current);
      const flow = search.get("flow");
      if (flow) keep.set("flow", flow);
      const qs = keep.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    };

    (async () => {
      // The link's OWN credentials always take precedence (BUG-015). An
      // already-existing session in this browser is never used here: it may
      // belong to a different account than the one the email was sent to.
      const linkError = hashParams.get("error_description") ?? search.get("error_description");
      if (linkError) {
        setInvalidReason(linkError.replace(/\+/g, " "));
        setStatus("invalid");
        return;
      }

      let established = false;
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        established = !error;
      } else if (search.get("code")) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        established = !error;
      }

      if (!established) {
        setInvalidReason(null);
        setStatus("invalid");
        return;
      }

      const { data } = await supabase.auth.getUser();
      scrubUrl();
      if (!data.user?.email) {
        setStatus("invalid");
        return;
      }
      setAccount({ id: data.user.id, email: data.user.email });
      setStatus("ready");
    })();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!account) return;

    setBusy(true);
    const result = await completePasswordSetup(password, account.id, inviteToken.current);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    setStatus("success");
    setTimeout(() => {
      router.replace(result.redirectTo || "/portal");
      router.refresh();
    }, 900);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <Card className="card-glow relative w-full max-w-md">
        {status === "checking" && (
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Checking your link…</p>
          </CardContent>
        )}

        {status === "invalid" && (
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
            <XCircle className="h-10 w-10 text-destructive" aria-hidden />
            <h1 className="font-heading text-lg font-semibold">This link has expired or is invalid</h1>
            <p className="text-sm text-muted-foreground">
              {invalidReason ?? "Open the most recent link from your email. Links work once and expire after a while."}
            </p>
            <div className="mt-2 flex gap-2">
              <Button asChild>
                <Link href="/forgot-password">Get help</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          </CardContent>
        )}

        {status === "success" && (
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center" role="status">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
            <h1 className="font-heading text-lg font-semibold">Your password has been set.</h1>
            <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
            <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          </CardContent>
        )}

        {status === "ready" && account && (
          <>
            <CardHeader>
              <CardTitle className="font-heading text-2xl">
            <h1>Create your password</h1>
          </CardTitle>
              <CardDescription>
                Setting the password for <strong className="text-foreground">{account.email}</strong>. You&apos;ll use it
                to sign in from now on.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && (
                  <Alert variant="destructive" role="alert">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Couldn&apos;t set your password</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <PasswordInput
                    id="confirm"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                  />
                </div>
                <Button type="submit" className="w-full glow-primary" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Set password
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
