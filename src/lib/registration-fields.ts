// Server-side validation of organizer-configured custom registration fields
// (BUG-026). Only keys belonging to active fields are kept; required values
// must be present; each value must match its field type; sizes are bounded.

export interface CustomFieldConfig {
  key: string;
  label: string;
  field_type: string;
  required: boolean;
  options?: unknown;
}

export const MAX_TEXT_LENGTH = 500;
export const MAX_TEXTAREA_LENGTH = 4000;

export type ExtraFieldsResult =
  | { ok: true; values: Record<string, string | number | boolean> }
  | { ok: false; error: string };

function optionList(options: unknown): string[] {
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
}

export function validateExtraFields(fields: CustomFieldConfig[], input: unknown): ExtraFieldsResult {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const values: Record<string, string | number | boolean> = {};

  for (const field of fields) {
    const value = raw[field.key];
    const isEmpty = value === undefined || value === null || (typeof value === "string" && value.trim() === "");

    if (isEmpty) {
      if (field.required && field.field_type !== "checkbox") return { ok: false, error: `${field.label} is required.` };
      if (field.required && field.field_type === "checkbox") return { ok: false, error: `${field.label} must be confirmed.` };
      continue;
    }

    switch (field.field_type) {
      case "text":
      case "textarea": {
        if (typeof value !== "string") return { ok: false, error: `${field.label} must be text.` };
        const max = field.field_type === "text" ? MAX_TEXT_LENGTH : MAX_TEXTAREA_LENGTH;
        if (value.trim().length > max) return { ok: false, error: `${field.label} must be ${max} characters or fewer.` };
        values[field.key] = value.trim();
        break;
      }
      case "number": {
        const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
        if (!Number.isFinite(n)) return { ok: false, error: `${field.label} must be a number.` };
        values[field.key] = n;
        break;
      }
      case "date": {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) || Number.isNaN(Date.parse(value.trim()))) {
          return { ok: false, error: `${field.label} must be a valid date.` };
        }
        values[field.key] = value.trim();
        break;
      }
      case "checkbox": {
        const b = value === true || value === "true" || value === "on";
        if (field.required && !b) return { ok: false, error: `${field.label} must be confirmed.` };
        values[field.key] = b;
        break;
      }
      case "select": {
        if (typeof value !== "string") return { ok: false, error: `${field.label} has an invalid choice.` };
        const opts = optionList(field.options);
        if (opts.length > 0 && !opts.includes(value)) return { ok: false, error: `${field.label} has an invalid choice.` };
        if (value.length > MAX_TEXT_LENGTH) return { ok: false, error: `${field.label} has an invalid choice.` };
        values[field.key] = value;
        break;
      }
      default:
        return { ok: false, error: `${field.label} uses an unsupported field type.` };
    }
  }

  return { ok: true, values };
}
