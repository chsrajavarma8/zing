import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";

// login/page.tsx is a client component ("use client"), which can't export
// `metadata` itself - Next.js resolves metadata from the nearest server
// component in the segment tree, so it lives here instead.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Sign In",
    description: "Sign in to your Zing Hackathon participant account.",
    path: "/login",
  }),
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
