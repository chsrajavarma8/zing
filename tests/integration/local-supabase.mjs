// Shared harness for integration tests. Refuses to run against anything but a
// local Supabase stack (`npx supabase start`): these tests create and delete
// users, teams, and storage objects, so they must never touch the project in
// .env.local or any hosted database.
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function readLocalStatus() {
  if (process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_ANON_KEY && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY) {
    return {
      API_URL: process.env.TEST_SUPABASE_URL,
      ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY,
      SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  const out = execSync("npx --no-install supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(out.slice(out.indexOf("{")));
}

export const env = readLocalStatus();

const host = new URL(env.API_URL).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error(`Refusing to run integration tests against non-local Supabase host: ${host}`);
}

export const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function anon() {
  return createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const runId = randomUUID().slice(0, 8);
const createdUsers = [];
const createdTeams = [];

export async function createUser(label) {
  const email = `it-${runId}-${label}@example.test`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdUsers.push(data.user.id);
  return { id: data.user.id, email, password };
}

export async function signIn(user) {
  const client = anon();
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return { client, session: data.session };
}

export async function defaultEvent() {
  const { data, error } = await service.from("events").select("*").eq("is_default", true).single();
  if (error) throw error;
  return data;
}

let mobileCounter = 0;
export function uniqueMobile() {
  mobileCounter += 1;
  const n = (Date.now() % 1_000_000_00) + mobileCounter;
  return `7${String(n).padStart(9, "0").slice(-9)}`;
}

export async function createTeam(eventId, members) {
  const { data: team, error } = await service
    .from("teams")
    .insert({ event_id: eventId, team_name: `IT ${runId} ${randomUUID().slice(0, 4)}`, status: "pending" })
    .select("*")
    .single();
  if (error) throw error;
  createdTeams.push(team.id);

  const rows = [];
  for (const m of members) {
    const mobile = uniqueMobile();
    const { data: row, error: mErr } = await service
      .from("team_members")
      .insert({
        event_id: eventId,
        team_id: team.id,
        profile_id: m.user?.id ?? null,
        role: m.role,
        full_name: m.name ?? `Member ${m.role}`,
        date_of_birth: m.dob ?? "2004-02-03",
        education_level: "college",
        college: "Integration College",
        roll_number: `R-${randomUUID().slice(0, 8)}`,
        email: m.email ?? m.user?.email,
        mobile,
        whatsapp: mobile,
        gender: m.gender ?? "Prefer not to say",
        consent_accepted: true,
      })
      .select("*")
      .single();
    if (mErr) throw mErr;
    rows.push(row);
  }
  return { team, members: rows };
}

export async function cleanup() {
  for (const id of createdTeams) await service.from("teams").delete().eq("id", id);
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
}
