"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateMyProfile } from "@/app/portal/profile/actions";
import type { TeamMember } from "@/types/database";

export function ProfileForm({ member }: { member: TeamMember }) {
  const [values, setValues] = useState({
    fullName: member.full_name,
    dateOfBirth: member.date_of_birth,
    college: member.college,
    rollNumber: member.roll_number,
    mobile: member.mobile,
    whatsapp: member.whatsapp,
    whatsappSameAsMobile: member.whatsapp_same_as_mobile,
    gender: member.gender ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await updateMyProfile(member.id, values);
    setSaving(false);
    if (result.ok) {
      toast.success("Profile updated");
    } else {
      toast.error(result.error || "Could not save changes");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" value={values.fullName} onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input
          id="dateOfBirth"
          type="date"
          value={values.dateOfBirth}
          onChange={(e) => setValues((v) => ({ ...v, dateOfBirth: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="college">College / institution</Label>
        <Input id="college" value={values.college} onChange={(e) => setValues((v) => ({ ...v, college: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rollNumber">College roll number</Label>
        <Input id="rollNumber" value={values.rollNumber} onChange={(e) => setValues((v) => ({ ...v, rollNumber: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mobile">Mobile number</Label>
        <Input id="mobile" value={values.mobile} onChange={(e) => setValues((v) => ({ ...v, mobile: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gender">Gender (optional)</Label>
        <Input id="gender" value={values.gender} onChange={(e) => setValues((v) => ({ ...v, gender: e.target.value }))} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="whatsappSameAsMobile"
            checked={values.whatsappSameAsMobile}
            onCheckedChange={(v) => setValues((s) => ({ ...s, whatsappSameAsMobile: Boolean(v) }))}
          />
          <Label htmlFor="whatsappSameAsMobile" className="font-normal">
            WhatsApp number is the same as mobile
          </Label>
        </div>
        {!values.whatsappSameAsMobile && (
          <Input
            placeholder="WhatsApp number"
            value={values.whatsapp}
            onChange={(e) => setValues((v) => ({ ...v, whatsapp: e.target.value }))}
          />
        )}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
