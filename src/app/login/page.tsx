"use client";

import { Suspense, useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, ArrowLeft, KeyRound, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { signIn } from "./actions";
import { Reveal } from "@/components/motion/reveal";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // The destination is validated server-side (same-origin paths only).
      const result = await signIn(email, password, next);
      if (!result.ok) {
        setError(result.error ?? "Unable to sign in. Check your email and password and try again.");
        return;
      }
      router.replace(result.redirectTo || "/portal");
      router.refresh();
    });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">

      <Reveal y={12} className="w-full max-w-md">
      <Card className="card-glow relative w-full max-w-md">
        <CardHeader>
          <Link
            href="/"
            className="mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <CardTitle className="font-heading text-2xl">
            <h1>Welcome to Zing Hackathon</h1>
          </CardTitle>
          <CardDescription>Sign in with your registered email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Couldn&apos;t sign you in</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary underline underline-offset-4">
                  Need help signing in?
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full glow-primary" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {isPending ? "Signing in…" : "Sign in"}
            </Button>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Your password is encrypted in transit and at rest. Organizers can reset your access if you&apos;re
              locked out, but they can never see your password.
            </p>

            <Accordion type="single" collapsible className="rounded-md border px-3">
              <AccordionItem value="first-time" className="border-b-0">
                <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" /> First-time login instructions
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    After your team registers, each member receives an invitation email. Open the link in that
                    email to set your own private password, then sign in here with your email and that password.
                  </p>
                  <p>
                    Didn&apos;t get the email? Check your spam folder, then contact support with your team reference
                    ID. Nobody else, including your team lead or the organizers, can see or set your password.
                  </p>
                  <p>
                    Registered before invitation emails were introduced? Sign in with the temporary password you
                    were given at registration; you&apos;ll be asked to set a private password straight away.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
              <p>
                Not registered yet?{" "}
                <Link href="/register" className="text-primary underline underline-offset-4">
                  Register your team
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
      </Reveal>
    </main>
  );
}
