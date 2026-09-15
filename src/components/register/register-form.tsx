"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, type SubmitHandler, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registrationSchema, type RegistrationInput, type ParticipantInput } from "@/lib/validations/registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StepIndicator } from "@/components/register/step-indicator";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  KeyRound,
  Copy,
  ArrowLeft,
  ArrowRight,
  Users,
  UserRound,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { shouldShowWhatsappGroupButton } from "@/lib/whatsapp";
import { GENDER_OPTIONS, type Gender } from "@/lib/gender";
import { Reveal } from "@/components/motion/reveal";

interface EventInfo {
  id: string;
  name: string;
  teamSizeMin: number;
  teamSizeMax: number;
  allowGenderField: boolean;
  genderFieldRequired: boolean;
  whatsappGroupUrl: string | null;
  whatsappGroupEnabled: boolean;
}

interface CustomField {
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
}

interface SuccessState {
  team: { referenceId: string; name: string };
  members: { referenceId: string; email: string; fullName: string; role: string; accountReady: boolean }[];
}

const STEPS = [{ label: "Team" }, { label: "Team Lead" }, { label: "Members" }, { label: "Review" }];

function emptyMember(role: "lead" | "member"): ParticipantInput {
  return {
    fullName: "",
    dateOfBirth: "",
    educationLevel: "college",
    college: "",
    rollNumber: "",
    classGrade: "",
    email: "",
    mobile: "",
    whatsapp: "",
    whatsappSameAsMobile: true,
    gender: "",
    role,
  };
}

export function RegisterForm({
  event,
  hasPolicies,
  customFields = [],
}: {
  event: EventInfo;
  hasPolicies: boolean;
  customFields?: CustomField[];
}) {
  const [step, setStep] = useState(0);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [customFieldError, setCustomFieldError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const form = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      eventId: event.id,
      teamName: "",
      members: [emptyMember("lead")],
      privacyAccepted: false as unknown as true,
      termsAccepted: false as unknown as true,
      promotionalConsent: false,
      extraFields: {},
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "members" });

  useEffect(() => {
    track({ name: "registration_started" });
    // Fire once per form mount, not per keystroke/re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goNext() {
    setCustomFieldError(null);
    setStepError(null);
    if (step === 0) {
      const ok = await form.trigger("teamName");
      const missingRequired = customFields.find((f) => f.required && !customValues[f.key]?.trim());
      if (missingRequired) {
        setCustomFieldError(`${missingRequired.label} is required.`);
        return;
      }
      if (!ok) {
        setStepError("Check the highlighted fields before continuing.");
        return;
      }
    } else if (step === 1) {
      const ok = await form.trigger([
        "members.0.fullName",
        "members.0.dateOfBirth",
        "members.0.college",
        "members.0.rollNumber",
        "members.0.classGrade",
        "members.0.email",
        "members.0.mobile",
        "members.0.whatsapp",
      ]);
      if (!ok) {
        setStepError("Check the highlighted fields before continuing.");
        return;
      }
    } else if (step === 2) {
      const currentCount = form.getValues("members").length;
      if (currentCount < event.teamSizeMin) {
        setStepError(
          `Your team needs at least ${event.teamSizeMin} member${event.teamSizeMin === 1 ? "" : "s"} (including the lead) - add ${event.teamSizeMin - currentCount} more before continuing.`,
        );
        return;
      }
      const ok = await form.trigger("members");
      if (!ok) {
        setStepError("Check the highlighted fields before continuing.");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const onSubmit: SubmitHandler<RegistrationInput> = async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, extraFields: customValues }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Registration failed. Please review the form and try again.");
        track({
          name: "form_failed",
          props: { form: "registration", reason: res.status === 429 ? "rate_limited" : res.status >= 500 ? "server_error" : "validation" },
        });
        return;
      }
      setSuccess(data);
      track({ name: "registration_completed", props: { teamSize: values.members.length } });
      toast.success("Team registered successfully");
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
      track({ name: "form_failed", props: { form: "registration", reason: "network" } });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    const anyAccountFailed = success.members.some((m) => !m.accountReady);
    return (
      <div>
        <StepIndicator steps={[...STEPS, { label: "Confirmation" }]} current={STEPS.length} />
        <Reveal y={12}>
        <Card className="card-glow border-primary/30">
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" />
            <CardTitle className="font-heading text-2xl">Your registration has been recorded.</CardTitle>
            <CardDescription>
              Your team reference is <strong>{success.team.referenceId}</strong>. Each participant can now sign in
              with a temporary password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Team name</p>
                <p className="font-medium">{success.team.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team reference</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-semibold">{success.team.referenceId}</p>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      navigator.clipboard.writeText(success.team.referenceId);
                      toast.success("Copied to clipboard");
                    }}
                    aria-label="Copy team reference"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registration status</p>
                <Badge variant="outline">Pending review</Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Team members</p>
              {success.members.map((m) => (
                <div key={m.referenceId} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {m.fullName} {m.role === "lead" && <Badge variant="secondary" className="ml-1">Lead</Badge>}
                    </p>
                    <p className="text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs">{m.referenceId}</p>
                    <Badge variant={m.accountReady ? "outline" : "destructive"}>
                      {m.accountReady ? "Ready to sign in" : "Needs support"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <Alert>
              <KeyRound className="h-4 w-4" />
              <AlertTitle>Next step: sign in with your temporary password</AlertTitle>
              <AlertDescription>
                No email is sent. Each team member signs in with their own email and a temporary password built
                from their team name, their own name, and their birth year: see &quot;First-time login
                instructions&quot; on the sign-in page for the exact formula. You&apos;ll be asked to set a private
                password the first time you sign in; no one else, including the team lead, can set it for you.
              </AlertDescription>
            </Alert>

            {anyAccountFailed && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>One or more accounts need support</AlertTitle>
                <AlertDescription>
                  Account setup didn&apos;t complete for a member marked &quot;Needs support&quot; above: contact
                  support with their reference ID and we&apos;ll sort it out.
                </AlertDescription>
              </Alert>
            )}

            {shouldShowWhatsappGroupButton({
              whatsapp_group_url: event.whatsappGroupUrl,
              whatsapp_group_enabled: event.whatsappGroupEnabled,
            }) && (
              <Button asChild variant="outline" className="border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/10">
                <a href={event.whatsappGroupUrl!} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" /> Join WhatsApp Group
                </a>
              </Button>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild className="glow-primary">
                <Link href="/login">Continue to sign in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/contact">Contact support</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        </Reveal>
      </div>
    );
  }

  const memberCount = fields.length;
  const memberErrors = form.formState.errors.members as FieldErrors<ParticipantInput[]> | undefined;

  return (
    <div>
      <StepIndicator steps={STEPS} current={step} />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* STEP 0: Team details */}
        {step === 0 && (
          <Card className="card-glow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="font-heading">Team details</CardTitle>
              </div>
              <CardDescription>
                Give your team a name. You&apos;ll add up to {event.teamSizeMax} members total, including the lead.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team name</Label>
                <Input id="teamName" {...form.register("teamName")} placeholder="e.g. Nullpointers" autoFocus />
                {form.formState.errors.teamName && (
                  <p className="text-sm text-destructive">{form.formState.errors.teamName.message}</p>
                )}
              </div>
              {customFields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={`custom-${f.key}`}>
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  {f.fieldType === "textarea" ? (
                    <textarea
                      id={`custom-${f.key}`}
                      className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-base"
                      value={customValues[f.key] ?? ""}
                      onChange={(e) => setCustomValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      id={`custom-${f.key}`}
                      type={f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : "text"}
                      value={customValues[f.key] ?? ""}
                      onChange={(e) => setCustomValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              {customFieldError && <p className="text-sm text-destructive">{customFieldError}</p>}
            </CardContent>
          </Card>
        )}

        {/* STEP 1: Team lead */}
        {step === 1 && (
          <Card className="card-glow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-primary" />
                <CardTitle className="font-heading">Team lead details</CardTitle>
              </div>
              <CardDescription>The team lead manages membership and final submissions.</CardDescription>
            </CardHeader>
            <CardContent>
              <MemberFields form={form} index={0} event={event} />
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Team members */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Team members</CardTitle>
                <CardDescription>
                  {event.teamSizeMin > 1 ? (
                    <>
                      Add at least {event.teamSizeMin - 1} more member{event.teamSizeMin - 1 === 1 ? "" : "s"}{" "}
                      (up to {event.teamSizeMax - 1}) - teams must have{" "}
                      {event.teamSizeMin === event.teamSizeMax
                        ? `exactly ${event.teamSizeMin} people`
                        : `${event.teamSizeMin}–${event.teamSizeMax} people`}
                      , including the lead.
                    </>
                  ) : (
                    `Optional: add up to ${event.teamSizeMax - 1} more members.`
                  )}
                </CardDescription>
              </CardHeader>
            </Card>

            {fields.slice(1).map((field, i) => {
              const index = i + 1;
              return (
                <Card key={field.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Member {index + 1}</CardTitle>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove member">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <MemberFields form={form} index={index} event={event} />
                  </CardContent>
                </Card>
              );
            })}

            {memberCount < event.teamSizeMin && (
              <p className="text-center text-sm text-muted-foreground">
                No additional members yet: add {event.teamSizeMin - memberCount} more below to meet the minimum team
                size.
              </p>
            )}

            {memberCount < event.teamSizeMax && (
              <Button type="button" variant="outline" onClick={() => append(emptyMember("member"))} className="w-full">
                <Plus className="h-4 w-4" /> Add another member
              </Button>
            )}
            {memberErrors?.root && <p className="text-sm text-destructive">{memberErrors.root.message}</p>}
            {form.formState.errors.members?.message && (
              <p className="text-sm text-destructive">{form.formState.errors.members.message}</p>
            )}
          </div>
        )}

        {/* STEP 3: Review & consent */}
        {step === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Check your details before submitting.</CardTitle>
                <CardDescription>Review everything below: you can go back to fix anything.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Team name</p>
                  <p className="font-medium">{form.getValues("teamName") || "N/A"}</p>
                </div>
                <Separator />
                <div className="space-y-3">
                  {form.getValues("members").map((m, i) => (
                    <div key={i} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{m.fullName || "N/A"}</p>
                        {m.role === "lead" && <Badge variant="secondary">Lead</Badge>}
                      </div>
                      <p className="text-muted-foreground">
                        {m.email} · {m.mobile} · {m.college}
                        {m.educationLevel === "college" && m.rollNumber ? ` (Roll no. ${m.rollNumber})` : ""}
                        {m.educationLevel === "school" && m.classGrade ? ` (Class ${m.classGrade})` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Consent</CardTitle>
                <CardDescription>
                  Entered by the person completing this form. Each team member confirms their own details and
                  applicable consent when they sign in and set their own password.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="termsAccepted"
                    checked={form.watch("termsAccepted") as unknown as boolean}
                    onCheckedChange={(v) => form.setValue("termsAccepted", v as unknown as true)}
                  />
                  <Label htmlFor="termsAccepted" className="font-normal">
                    I have read and agree to the event{" "}
                    <Link href="/terms" target="_blank" className="text-primary underline underline-offset-4">
                      Terms and Conditions
                    </Link>{" "}
                    and{" "}
                    <Link href="/rules" target="_blank" className="text-primary underline underline-offset-4">
                      Rules
                    </Link>
                    .
                  </Label>
                </div>
                {form.formState.errors.termsAccepted && (
                  <p className="text-sm text-destructive">{form.formState.errors.termsAccepted.message}</p>
                )}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="privacyAccepted"
                    checked={form.watch("privacyAccepted") as unknown as boolean}
                    onCheckedChange={(v) => form.setValue("privacyAccepted", v as unknown as true)}
                  />
                  <Label htmlFor="privacyAccepted" className="font-normal">
                    I have read the{" "}
                    <Link href="/privacy" target="_blank" className="text-primary underline underline-offset-4">
                      Privacy Policy
                    </Link>
                    .{!hasPolicies && <span className="ml-1 text-xs text-muted-foreground">(draft: organizer review pending)</span>}
                  </Label>
                </div>
                {form.formState.errors.privacyAccepted && (
                  <p className="text-sm text-destructive">{form.formState.errors.privacyAccepted.message}</p>
                )}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="promotionalConsent"
                    checked={form.watch("promotionalConsent")}
                    onCheckedChange={(v) => form.setValue("promotionalConsent", Boolean(v))}
                  />
                  <Label htmlFor="promotionalConsent" className="font-normal">
                    I would like to receive promotional updates from Skillglider.
                  </Label>
                </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-3">
                {submitError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Couldn&apos;t submit registration</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" size="lg" disabled={isSubmitting} className="glow-primary">
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit registration
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {stepError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{stepError}</AlertDescription>
          </Alert>
        )}

        {/* NAVIGATION */}
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0 || isSubmitting}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button type="button" onClick={goNext}>
              {step === 2 ? "Review registration" : "Continue"} <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function MemberFields({
  form,
  index,
  event,
}: {
  form: ReturnType<typeof useForm<RegistrationInput>>;
  index: number;
  event: EventInfo;
}) {
  const errors = form.formState.errors.members?.[index];
  const sameAsMobile = form.watch(`members.${index}.whatsappSameAsMobile`);
  const educationLevel = form.watch(`members.${index}.educationLevel`);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`members.${index}.fullName`}>Full name</Label>
        <Input id={`members.${index}.fullName`} placeholder="As per school/college ID" {...form.register(`members.${index}.fullName`)} />
        <FieldError err={errors?.fullName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`members.${index}.dateOfBirth`}>Date of birth</Label>
        <Input type="date" id={`members.${index}.dateOfBirth`} {...form.register(`members.${index}.dateOfBirth`)} />
        <FieldError err={errors?.dateOfBirth} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`members.${index}.educationLevel`}>Studying in</Label>
        <Select
          value={educationLevel}
          onValueChange={(v) => form.setValue(`members.${index}.educationLevel`, v as "school" | "college")}
        >
          <SelectTrigger id={`members.${index}.educationLevel`} className="w-full sm:w-64">
            <SelectValue placeholder="Select education level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="school">School</SelectItem>
            <SelectItem value="college">College / university</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`members.${index}.college`}>{educationLevel === "school" ? "School name" : "College / institution"}</Label>
        <Input
          id={`members.${index}.college`}
          placeholder={educationLevel === "school" ? "e.g. Delhi Public School" : "e.g. IIT Bombay"}
          {...form.register(`members.${index}.college`)}
        />
        <FieldError err={errors?.college} />
      </div>
      {educationLevel === "school" ? (
        <div className="space-y-2">
          <Label htmlFor={`members.${index}.classGrade`}>Class / grade</Label>
          <Input id={`members.${index}.classGrade`} placeholder="e.g. Class 10" {...form.register(`members.${index}.classGrade`)} />
          <FieldError err={errors?.classGrade} />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`members.${index}.rollNumber`}>College roll number</Label>
          <Input id={`members.${index}.rollNumber`} {...form.register(`members.${index}.rollNumber`)} />
          <p className="text-xs text-muted-foreground">Enter your roll number as issued by your institution.</p>
          <FieldError err={errors?.rollNumber} />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`members.${index}.email`}>Email address</Label>
        <Input type="email" id={`members.${index}.email`} placeholder="you@college.edu" {...form.register(`members.${index}.email`)} />
        <p className="text-xs text-muted-foreground">This is your sign-in username: no email is sent, so it just needs to be correct.</p>
        <FieldError err={errors?.email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`members.${index}.mobile`}>Mobile number</Label>
        <div className="flex items-center gap-2">
          <span className="flex h-9 shrink-0 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">+91</span>
          <Input
            id={`members.${index}.mobile`}
            placeholder="10-digit mobile number"
            inputMode="numeric"
            maxLength={10}
            {...form.register(`members.${index}.mobile`)}
          />
        </div>
        <FieldError err={errors?.mobile} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`members.${index}.whatsappSameAsMobile`}
            checked={sameAsMobile}
            onCheckedChange={(v) => form.setValue(`members.${index}.whatsappSameAsMobile`, Boolean(v))}
          />
          <Label htmlFor={`members.${index}.whatsappSameAsMobile`} className="font-normal">
            Use my mobile number for WhatsApp.
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">Provide an active number for event updates through supported organizer channels.</p>
        {!sameAsMobile && (
          <div className="space-y-2 pt-1">
            <Label htmlFor={`members.${index}.whatsapp`}>WhatsApp number</Label>
            <div className="flex items-center gap-2">
              <span className="flex h-9 shrink-0 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">+91</span>
              <Input
                id={`members.${index}.whatsapp`}
                placeholder="10-digit WhatsApp number"
                inputMode="numeric"
                maxLength={10}
                {...form.register(`members.${index}.whatsapp`)}
              />
            </div>
            <FieldError err={errors?.whatsapp} />
          </div>
        )}
      </div>
      {event.allowGenderField && (
        <div className="space-y-2">
          <Label htmlFor={`members.${index}.gender`}>
            Gender {event.genderFieldRequired ? "" : <span className="text-muted-foreground">(optional)</span>}
          </Label>
          <Select
            value={form.watch(`members.${index}.gender`) || undefined}
            onValueChange={(v) => form.setValue(`members.${index}.gender`, v as Gender)}
          >
            <SelectTrigger id={`members.${index}.gender`} className="w-full">
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
          <FieldError err={errors?.gender} />
        </div>
      )}
    </div>
  );
}

function FieldError({ err }: { err?: { message?: string } }) {
  if (!err?.message) return null;
  return <p className="text-sm text-destructive">{err.message}</p>;
}
