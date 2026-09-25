import { z } from "zod";
import { isValidPhone, normalizePhoneInput, PHONE_VALIDATION_MESSAGE } from "@/lib/phone";
import { GENDER_OPTIONS } from "@/lib/gender";

// Req.: school students must not be forced to provide college-specific
// details. `college` doubles as "school or college name" for both levels;
// `rollNumber` (college) and `classGrade` (school) are each required only
// for their own education level - enforced via validateEducationFields()
// rather than baked into the field schema itself, so participantSchema stays
// a plain ZodObject (callers like the "add member" action still `.omit()`
// fields from it - see src/app/portal/team/actions.ts).
export const EDUCATION_LEVELS = ["school", "college"] as const;

// A real calendar date in YYYY-MM-DD form (what <input type="date"> sends and
// what the date column stores), not in the future and not absurdly old.
export function isValidBirthDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false;
  return y >= 1900 && date.getTime() <= Date.now();
}
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const participantSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  dateOfBirth: z.string().trim().refine(isValidBirthDate, "Enter a valid date of birth."),
  educationLevel: z.enum(EDUCATION_LEVELS),
  college: z.string().trim().min(2, "Enter your school or college name.").max(200),
  rollNumber: z.string().trim().max(60),
  classGrade: z.string().trim().max(40),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  mobile: z
    .string()
    .trim()
    .transform((v) => normalizePhoneInput(v))
    .refine((v) => isValidPhone(v), PHONE_VALIDATION_MESSAGE),
  // No regex here: validity depends on whatsappSameAsMobile, checked via
  // superRefine wherever this schema is actually used for submission - see
  // validateWhatsapp() below. Keeping this field loosely typed (not wrapped
  // in .superRefine at this level) means participantSchema stays a plain
  // ZodObject, so callers can still `.omit()` fields from it (e.g. `role`
  // when a team lead adds a member post-registration).
  whatsapp: z.string().trim(),
  whatsappSameAsMobile: z.boolean(),
  gender: z.enum(GENDER_OPTIONS).optional().or(z.literal("")),
  role: z.enum(["lead", "member"]),
});

export type ParticipantInput = z.infer<typeof participantSchema>;

export function validateWhatsapp(member: Pick<ParticipantInput, "whatsapp" | "whatsappSameAsMobile">): boolean {
  if (member.whatsappSameAsMobile) return true;
  return isValidPhone(member.whatsapp);
}

// Returns null when valid, or a { field, message } issue to attach - keeps
// the "which field, which message" decision in one place for every caller
// (registration, add-member, profile edit) instead of duplicating it.
export function validateEducationFields(
  member: Pick<ParticipantInput, "educationLevel" | "rollNumber" | "classGrade">,
): { field: "rollNumber" | "classGrade"; message: string } | null {
  if (member.educationLevel === "college" && !member.rollNumber?.trim()) {
    return { field: "rollNumber", message: "Enter your college roll number." };
  }
  if (member.educationLevel === "school" && !member.classGrade?.trim()) {
    return { field: "classGrade", message: "Enter your class or grade." };
  }
  return null;
}

export const registrationSchema = z
  .object({
    eventId: z.string().uuid(),
    teamName: z.string().trim().min(2, "Enter your team name.").max(120),
    members: z.array(participantSchema).min(1),
    privacyAccepted: z.literal(true, { message: "You must confirm you've read the Privacy Policy." }),
    termsAccepted: z.literal(true, { message: "You must agree to the Terms and Conditions and Rules." }),
    promotionalConsent: z.boolean(),
    extraFields: z.record(z.string(), z.unknown()),
  })
  .superRefine((data, ctx) => {
    for (const issue of memberCrossFieldIssues(data.members)) {
      ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
    }
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

export type MemberIssueField = "whatsapp" | "rollNumber" | "classGrade" | "email" | "mobile";

export interface MemberIssue {
  // ["members"] for team-level issues, ["members", i, field] for a member field.
  path: ["members"] | ["members", number, MemberIssueField];
  message: string;
}

type CrossFieldMember = Pick<
  ParticipantInput,
  "role" | "whatsapp" | "whatsappSameAsMobile" | "educationLevel" | "rollNumber" | "classGrade" | "email" | "mobile" | "college"
>;

// Cross-field rules that a per-field schema can't express (BUG-004). Used by
// registrationSchema's superRefine (server + final submit) AND directly by
// the multi-step form for each step, because Zod skips object-level
// refinements while any other part of the object (e.g. the consent
// checkboxes on the last step) is still invalid - which is exactly how these
// errors used to stay hidden until the final step. `onlyIndices` limits
// member-level checks to the members visible on the current step; duplicate
// checks always compare against the whole team.
export function memberCrossFieldIssues(members: CrossFieldMember[], onlyIndices?: number[]): MemberIssue[] {
  const issues: MemberIssue[] = [];
  const include = (i: number) => !onlyIndices || onlyIndices.includes(i);

  if (!onlyIndices && members.filter((m) => m.role === "lead").length !== 1) {
    issues.push({ path: ["members"], message: "A team must have exactly one lead." });
  }

  members.forEach((m, i) => {
    if (!include(i)) return;
    if (!validateWhatsapp(m)) issues.push({ path: ["members", i, "whatsapp"], message: "Enter a valid WhatsApp number." });
    const educationIssue = validateEducationFields(m);
    if (educationIssue) issues.push({ path: ["members", i, educationIssue.field], message: educationIssue.message });
  });

  const firstIndexOf = (key: (m: CrossFieldMember) => string | null) => {
    const seen = new Map<string, number>();
    return members.map((m, i) => {
      const k = key(m);
      if (!k) return -1;
      if (seen.has(k)) return seen.get(k)!;
      seen.set(k, i);
      return -1;
    });
  };

  const dupEmail = firstIndexOf((m) => m.email.trim().toLowerCase() || null);
  const dupMobile = firstIndexOf((m) => normalizePhoneInput(m.mobile) || null);
  const dupRoll = firstIndexOf((m) =>
    m.educationLevel === "college" && m.rollNumber?.trim() ? `${m.college.trim().toLowerCase()}::${m.rollNumber.trim().toLowerCase()}` : null,
  );

  members.forEach((_, i) => {
    if (!include(i)) return;
    if (dupEmail[i] >= 0) issues.push({ path: ["members", i, "email"], message: "This email is already used by another member of this team." });
    if (dupMobile[i] >= 0) issues.push({ path: ["members", i, "mobile"], message: "This mobile number is already used by another member of this team." });
    if (dupRoll[i] >= 0) {
      issues.push({ path: ["members", i, "rollNumber"], message: "This college + roll number is already used by another member of this team." });
    }
  });

  return issues;
}
