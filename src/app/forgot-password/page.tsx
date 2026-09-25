import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Mail, Phone, ShieldAlert } from "lucide-react";
import { getPublicEvent } from "@/lib/events";
import { telHref } from "@/lib/utils";

export const metadata = { title: "Need help signing in?", robots: { index: false, follow: false } };

export default async function ForgotPasswordPage() {
  const event = await getPublicEvent();
  const supportEmail = event?.support_email ?? "skillglider4@gmail.com";
  const supportPhone = event?.support_phone ?? "+91 7993446574";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">

      <Card className="card-glow relative w-full max-w-md">
        <CardHeader>
          <Link href="/login" className="mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
          <CardTitle className="font-heading text-2xl">
            <h1>Need help signing in?</h1>
          </CardTitle>
          <CardDescription>Contact support: our team will verify your identity and help you regain access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button className="glow-primary" asChild>
              <a href={`mailto:${supportEmail}`}>
                <Mail className="h-4 w-4" /> {supportEmail}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={telHref(supportPhone)}>
                <Phone className="h-4 w-4" /> {supportPhone}
              </a>
            </Button>
          </div>

          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              Include your registered email address and team reference ID. We verify your identity through
              additional details on file before helping you regain access: never through your date of birth or
              team name alone, since those aren&apos;t secret.
            </AlertDescription>
          </Alert>

          <p className="text-center text-sm text-muted-foreground">
            Not registered yet?{" "}
            <Link href="/register" className="text-primary underline underline-offset-4">
              Register your team
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
