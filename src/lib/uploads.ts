// Upload validation shared by the signed-upload routes (RISK-001, RISK-008).
// The browser uploads straight to Supabase Storage with a short-lived,
// single-path signed URL (so the 4.5 MB Vercel Function body limit doesn't
// apply), and the server then verifies the stored object's real size and
// leading bytes before recording it. Client-declared MIME types and file
// extensions are never trusted on their own.

export type UploadKind = "pdf" | "png" | "jpeg" | "webp" | "ole" | "zip";

export interface AllowedType {
  mime: string;
  extensions: string[];
  kind: UploadKind;
}

export const SUBMISSION_TYPES: AllowedType[] = [
  { mime: "application/pdf", extensions: ["pdf"], kind: "pdf" },
  { mime: "application/msword", extensions: ["doc"], kind: "ole" },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: ["docx"], kind: "zip" },
  { mime: "application/vnd.ms-powerpoint", extensions: ["ppt"], kind: "ole" },
  { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extensions: ["pptx"], kind: "zip" },
  { mime: "image/png", extensions: ["png"], kind: "png" },
  { mime: "image/jpeg", extensions: ["jpg", "jpeg"], kind: "jpeg" },
];

export const DOCUMENT_TYPES: AllowedType[] = [
  { mime: "application/pdf", extensions: ["pdf"], kind: "pdf" },
  { mime: "image/png", extensions: ["png"], kind: "png" },
  { mime: "image/jpeg", extensions: ["jpg", "jpeg"], kind: "jpeg" },
];

// SVG is deliberately not accepted for branding: it can carry script, and
// its content can't be validated by a signature check.
export const BRANDING_TYPES: AllowedType[] = [
  { mime: "image/png", extensions: ["png"], kind: "png" },
  { mime: "image/jpeg", extensions: ["jpg", "jpeg"], kind: "jpeg" },
  { mime: "image/webp", extensions: ["webp"], kind: "webp" },
];

export const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_BRANDING_BYTES = 5 * 1024 * 1024;

export function fileExtension(name: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

// Matches the declared MIME type AND the file extension against one allowed
// entry - both must agree before a signed upload URL is issued.
export function matchAllowedType(allowed: AllowedType[], fileName: string, mime: string): AllowedType | null {
  const ext = fileExtension(fileName);
  return allowed.find((t) => t.mime === mime && t.extensions.includes(ext)) ?? null;
}

export function detectKind(bytes: Uint8Array): UploadKind | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts([0xff, 0xd8, 0xff])) return "jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "webp"; // RIFF....WEBP
  if (starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole"; // legacy .doc/.ppt
  if (starts([0x50, 0x4b, 0x03, 0x04])) return "zip"; // .docx/.pptx containers
  return null;
}

// Storage paths are always server-built: <prefix>/<uuid>-<sanitized name>.
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-120) || "file";
}

export function isPathUnder(path: string, prefix: string): boolean {
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  return path.startsWith(`${prefix}/`) && !path.slice(prefix.length + 1).includes("/");
}
