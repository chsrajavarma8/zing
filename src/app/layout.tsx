import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsPageView } from "@/components/analytics-page-view";
import { CookieConsentBanner } from "@/components/site/cookie-consent-banner";
import { SiteBackground } from "@/components/site/site-background";
import { getSiteUrl } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geometric display face for headings - Geist stays the body/UI face
// (forms, tables) since it's built for readability at small sizes.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const SITE_URL = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Zing Hackathon by Skillglider | ₹4 Lakh Prize Pool",
    template: "%s | Zing Hackathon",
  },
  description: "Build something original. Register, compete, and track your progress in the Zing Hackathon by Skillglider.",
  openGraph: {
    siteName: "Zing Hackathon by Skillglider",
    type: "website",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
  },
};

// One light theme only - no next-themes, no .dark class, no system-theme
// detection, nothing to persist or restore. color-scheme here (plus the
// matching meta below) tells the browser itself - including native form
// controls and the scrollbar - to render light, so there's no dark flash
// from a browser/OS dark-mode preference before any CSS loads.
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#FFF9F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Without JavaScript the scroll-reveal animation never runs; show the
            content in its final state instead of leaving it at opacity 0. */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <TooltipProvider>
          {/* Mounted once, here, for the whole app - see the component for
              why: intensity varies by route internally rather than needing
              a prop from every layout that uses it. */}
          <SiteBackground />
          <AnalyticsPageView />
          {children}
          <CookieConsentBanner />
          <Toaster richColors closeButton position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
