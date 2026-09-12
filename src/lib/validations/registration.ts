import { z } from "zod";
import { isValidPhone, normalizePhoneInput, PHONE_VALIDATION_MESSAGE } from "@/lib/phone";
import { GENDER_OPTIONS } from "@/lib/gender";

export const participantSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  dateOfBirth: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date of birth."),
  college: z.string().trim().min(2, "Enter your college or institution.").max(200),
  rollNumber: z.string().trim().min(1, "Enter your college roll number.").max(60),
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
    });
    const emails = data.members.map((m) => m.email.toLowerCase());
    if (new Set(emails).size !== emails.length) {
      ctx.addIssue({ code: "custom", message: "This email is already used by another member of this team.", path: ["members"] });
    }
    const rolls = data.members.map((m) => `${m.college.toLowerCase()}::${m.rollNumber.toLowerCase()}`);
    if (new Set(rolls).size !== rolls.length) {
      ctx.addIssue({
        code: "custom",
        message: "This college + roll number is already used by another member of this team.",
        path: ["members"],
      });
    }
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
