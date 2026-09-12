import { getPortalContext } from "@/lib/portal/data";
import { ProfileForm } from "@/components/portal/profile-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function ProfilePage() {
  const portal = await getPortalContext();
  if (!portal) return null;
  const { membership } = portal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="text-muted-foreground">Reference ID: {membership.reference_id}</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Email address</CardTitle>
            <CardDescription>{membership.email}</CardDescription>
          </div>
          <Badge variant={membership.verification_status === "verified" ? "default" : "outline"}>
            {membership.verification_status}
          </Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your email is tied to your sign-in and can&apos;t be changed here. Need it updated? Send an{" "}
          <Link href="/portal/requests" className="text-primary underline underline-offset-4">
            organizer request
          </Link>
          .
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal details</CardTitle>
          <CardDescription>Editable fields: changes save immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm member={membership} />
        </CardContent>
      </Card>
    </div>
  );
}
