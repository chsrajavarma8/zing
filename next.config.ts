import type { NextConfig } from "next";

// Security headers (BUG-024). The CSP deliberately covers only directives that
// are safe for statically prerendered pages: framing (clickjacking), <base>
// injection, plugins, and form targets. A nonce-based script-src would
// require dynamic rendering of every page (see node_modules/next/dist/docs/
// 01-app/02-guides/content-security-policy.md), so script/style sources are
// not restricted yet - these headers are defense in depth, not a substitute
// for fixing injection bugs.
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Only meaningful over HTTPS; browsers ignore it on plain-HTTP localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
