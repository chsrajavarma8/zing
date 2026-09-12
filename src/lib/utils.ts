export { cn } from "cn"

// tel: links must not contain spaces/parens for reliable dialing, but the
// display text can stay human-formatted (e.g. "+91 7993446574").
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}
