// Shared validation for the admin-configured WhatsApp group invite link
// (req. #16 - a group invite only, never used for outbound notifications).

const GROUP_LINK_RE = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,}$/;

export function isValidWhatsappGroupUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return GROUP_LINK_RE.test(url.trim());
}

// True only when the admin has both entered a valid link and switched the
// feature on - the single check every "show the button" call site should use.
export function shouldShowWhatsappGroupButton(event: { whatsapp_group_url: string | null; whatsapp_group_enabled: boolean }): boolean {
  return event.whatsapp_group_enabled && isValidWhatsappGroupUrl(event.whatsapp_group_url);
}
