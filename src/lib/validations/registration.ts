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
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const participantSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  dateOfBirth: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date of birth."),
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
    const leads = data.members.filter((m) => m.role === "lead");
    if (leads.length !== 1) {
      ctx.addIssue({ code: "custom", message: "A team must have exactly one lead.", path: ["members"] });
    }
    data.members.forEach((m, i) => {
      if (!validateWhatsapp(m)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid WhatsApp number.", path: ["members", i, "whatsapp"] });
      }
      const educationIssue = validateEducationFields(m);
      if (educationIssue) {
        ctx.addIssue({ code: "custom", message: educationIssue.message, path: ["members", i, educationIssue.field] });
      }
    });
    const emails = data.members.map((m) => m.email.toLowerCase());
    if (new Set(emails).size !== emails.length) {
      ctx.addIssue({ code: "custom", message: "This email is already used by another member of this team.", path: ["members"] });
    }
    const seenMobiles = new Map<string, number>();
    data.members.forEach((m, i) => {
      const prevIndex = seenMobiles.get(m.mobile);
      if (prevIndex !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "This mobile number is already used by another member of this team.",
          path: ["members", i, "mobile"],
        });
      } else {
        seenMobiles.set(m.mobile, i);
      }
    });
    // Roll-number dedup only makes sense for college members who actually
    // have one - school members share no such identifier.
    const seenRolls = new Map<string, number>();
    data.members.forEach((m, i) => {
      if (m.educationLevel !== "college" || !m.rollNumber?.trim()) return;
      const key = `${m.college.toLowerCase()}::${m.rollNumber.toLowerCase()}`;
      const prevIndex = seenRolls.get(key);
      if (prevIndex !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "This college + roll number is already used by another member of this team.",
          path: ["members"],
        });
      } else {
        seenRolls.set(key, i);
      }
    });
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
