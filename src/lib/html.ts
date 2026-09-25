// Plain-text -> HTML for transactional email (RISK-007). Every interpolated
// value is escaped; line breaks are the only formatting carried over.
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function plainTextToEmailHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`);
  return paragraphs.join("");
}
