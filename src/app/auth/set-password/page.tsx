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
import { createClient } from "@/lib/supabase/client";
import { completePasswordSetup } from "./actions";

type Status = "checking" | "ready" | "invalid" | "success";

export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const redirectTarget = useRef("/portal");
  const inviteToken = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Captured once, up front, independently of the hash/session-detection
    // logic below (which rewrites the URL) - this is the admin invite's
    // single-use token, not something we can afford to lose mid-flow.
    inviteToken.current = new URLSearchParams(window.location.search).get("invite") ?? undefined;

    const supabase = createClient();
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setStatus("ready");
        return;
      }

      // Recovery/invite links generated via the admin API redirect using the
      // older implicit flow - tokens land in the URL hash (#access_token=...),
      // not a `?code=` param. @supabase/ssr's browser client (built around
      // cookie + PKCE sessions) never auto-parses that hash, so it has to be
      // handled explicitly here.
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!error) {
          // Scrub the access token out of the URL bar/history now that it's
          // consumed, but keep the `?invite=` param - it's still needed on
          // submit.
          const clean = inviteToken.current
            ? `${window.location.pathname}?invite=${encodeURIComponent(inviteToken.current)}`
            : window.location.pathname;
          window.history.replaceState(null, "", clean);
          setStatus("ready");
          return;
        }
      }

      const url = new URL(window.location.href);
      if (url.searchParams.get("code")) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (!error) {
          setStatus("ready");
          return;
        }
      }

      setStatus("invalid");
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

    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message || "Could not set your password. Please try again.");
      setBusy(false);
      return;
    }

    const result = await completePasswordSetup(inviteToken.current);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    redirectTarget.current = result.redirectTo || "/portal";
    setStatus("success");
    setTimeout(() => {
      router.replace(redirectTarget.current);
      router.refresh();
    }, 900);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">

      <Card className="card-glow relative w-full max-w-md">
        {status === "checking" && (
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Checking your link…</p>
          </CardContent>
        )}

        {status === "invalid" && (
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="font-heading text-lg font-semibold">This link has expired or is invalid</p>
            <p className="text-sm text-muted-foreground">Request a new link to set your password.</p>
            <div className="mt-2 flex gap-2">
              <Button asChild>
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          </CardContent>
        )}

        {status === "success" && (
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-heading text-lg font-semibold">Your password has been set.</p>
            <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
            <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
          </CardContent>
        )}

        {status === "ready" && (
          <>
            <CardHeader>
              <CardTitle className="font-heading text-2xl">Create your password</CardTitle>
              <CardDescription>Choose a password you&apos;ll use to sign in from now on.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && (
                  <Alert variant="destructive">
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
