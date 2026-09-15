"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateMyProfile } from "@/app/portal/profile/actions";
import { GENDER_OPTIONS } from "@/lib/gender";
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from "@/lib/phone";
import type { TeamMember } from "@/types/database";

export function ProfileForm({ member }: { member: TeamMember }) {
  const [values, setValues] = useState({
    fullName: member.full_name,
    dateOfBirth: member.date_of_birth,
    educationLevel: member.education_level,
    college: member.college,
    rollNumber: member.roll_number ?? "",
    classGrade: member.class_grade ?? "",
    mobile: member.mobile,
    whatsapp: member.whatsapp,
    whatsappSameAsMobile: member.whatsapp_same_as_mobile,
    gender: member.gender ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidPhone(values.mobile)) {
      setError(PHONE_VALIDATION_MESSAGE);
      return;
    }
    if (!values.whatsappSameAsMobile && !isValidPhone(values.whatsapp)) {
      setError(`WhatsApp: ${PHONE_VALIDATION_MESSAGE}`);
      return;
    }

    setSaving(true);
    const result = await updateMyProfile(member.id, values);
    setSaving(false);
    if (result.ok) {
      toast.success("Profile updated");
    } else {
      setError(result.error || "Could not save changes");
      toast.error(result.error || "Could not save changes");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      {error && (
        <Alert variant="destructive" className="sm:col-span-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
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
        <Label htmlFor="educationLevel">Studying in</Label>
        <Select value={values.educationLevel} onValueChange={(v) => setValues((s) => ({ ...s, educationLevel: v as "school" | "college" }))}>
          <SelectTrigger id="educationLevel" className="w-full">
            <SelectValue placeholder="Select education level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="school">School</SelectItem>
            <SelectItem value="college">College / university</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="college">{values.educationLevel === "school" ? "School name" : "College / institution"}</Label>
        <Input id="college" value={values.college} onChange={(e) => setValues((v) => ({ ...v, college: e.target.value }))} />
      </div>
      {values.educationLevel === "school" ? (
        <div className="space-y-2">
          <Label htmlFor="classGrade">Class / grade</Label>
          <Input id="classGrade" value={values.classGrade} onChange={(e) => setValues((v) => ({ ...v, classGrade: e.target.value }))} />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="rollNumber">College roll number</Label>
          <Input id="rollNumber" value={values.rollNumber} onChange={(e) => setValues((v) => ({ ...v, rollNumber: e.target.value }))} />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="mobile">Mobile number</Label>
        <Input
          id="mobile"
          inputMode="numeric"
          maxLength={10}
          value={values.mobile}
          onChange={(e) => setValues((v) => ({ ...v, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gender">Gender (optional)</Label>
        <Select value={values.gender || undefined} onValueChange={(v) => setValues((s) => ({ ...s, gender: v }))}>
          <SelectTrigger id="gender" className="w-full">
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            {GENDER_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Kept private - never shown on any public page.</p>
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
            inputMode="numeric"
            maxLength={10}
            value={values.whatsapp}
            onChange={(e) => setValues((v) => ({ ...v, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
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
