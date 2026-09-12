// Shared phone-number handling: participants are assumed to be in India
// (the whole site runs on IST / DD-MM-YYYY), so the country code is fixed
// and never entered by the user - the stored/validated value is always
// exactly the 10-digit national number.

export const PHONE_COUNTRY_CODE = "+91";

// Strips a leading "+91"/"91"/"0" or stray spaces/dashes some users paste in
// from their contacts app, so validation judges the actual 10-digit number
// rather than rejecting a harmless country-code prefix.
export function normalizePhoneInput(raw: string): string {
  let digits = raw.trim().replace(/[\s-]/g, "");
  digits = digits.replace(/^\+?91/, "");
  digits = digits.replace(/^0+(?=\d{10}$)/, "");
  return digits;
}

const TEN_DIGITS_RE = /^\d{10}$/;

export function isValidPhone(raw: string): boolean {
  return TEN_DIGITS_RE.test(normalizePhoneInput(raw));
}

export const PHONE_VALIDATION_MESSAGE = "Enter a valid 10-digit mobile number (without the country code).";
