import type { Metadata } from "next";

// set-password/page.tsx is a client component and can't export `metadata`
// itself - see the identical note in src/app/login/layout.tsx.
export const metadata: Metadata = {
  title: "Set Your Password",
  robots: { index: false, follow: false },
};

export default function SetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
