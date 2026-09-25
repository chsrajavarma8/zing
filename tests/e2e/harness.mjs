// End-to-end harness: talks to a RUNNING production build of the app
// (`next build && next start`) that points at the LOCAL Supabase stack, and
// invokes server actions / route handlers exactly as a browser - or an
// attacker replaying requests - would. Refuses non-local targets.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";
import { env } from "../integration/local-supabase.mjs";

export const APP_URL = process.env.E2E_APP_URL ?? "http://localhost:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(APP_URL).hostname)) {
  throw new Error(`Refusing to run e2e tests against non-local app: ${APP_URL}`);
}

const manifest = JSON.parse(readFileSync(path.join(process.cwd(), ".next/server/server-reference-manifest.json"), "utf8"));

// Finds a server action's id by source file + export name.
export function actionId(filename, exportedName) {
  for (const [id, entry] of Object.entries(manifest.node ?? {})) {
    if (entry.filename === filename && entry.exportedName === exportedName) return id;
  }
  throw new Error(`server action not found: ${filename}#${exportedName} (rebuild the app?)`);
}

// Signs in through @supabase/ssr so the cookies match what the app expects.
export async function sessionCookies(user) {
  const jar = new Map();
  const client = createServerClient(env.API_URL, env.ANON_KEY, {
    // No background refresh timer: it would keep the test process alive.
    auth: { autoRefreshToken: false, detectSessionInUrl: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

// Invokes a server action. `pagePath` must be a route whose bundle includes
// the action (the page that imports it). Returns the action's return value.
export async function callAction({ file, name, pagePath, args, cookie }) {
  const res = await fetch(`${APP_URL}${pagePath}`, {
    method: "POST",
    headers: {
      "Next-Action": actionId(file, name),
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
      Origin: APP_URL,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(args),
    redirect: "manual",
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("1:"));
  if (!line) return { __status: res.status, __raw: text.slice(0, 300) };
  return JSON.parse(line.slice(2));
}

export async function getPage(pagePath, cookie) {
  const res = await fetch(`${APP_URL}${pagePath}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

export async function postJson(pagePath, body, cookie) {
  const res = await fetch(`${APP_URL}${pagePath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
