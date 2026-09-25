// Minimal Chrome DevTools Protocol driver for browser tests - no extra
// packages (Node 24 has a global WebSocket). Works with Chrome and Edge.
// Browser: BROWSER_PATH, else Chrome, else Edge at their default Windows paths.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CANDIDATES = {
  chrome: ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
  edge: ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "/usr/bin/microsoft-edge"],
};

export function browserPath(kind = process.env.BROWSER ?? "chrome") {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  return (CANDIDATES[kind] ?? []).find((p) => existsSync(p)) ?? null;
}

export async function launch(kind) {
  const exe = browserPath(kind);
  if (!exe) throw new Error(`No ${kind} browser found; set BROWSER_PATH.`);
  const profile = mkdtempSync(path.join(tmpdir(), "zing-cdp-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });
  let version;
  for (let i = 0; i < 100 && !version; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  if (!version) throw new Error("browser did not start");
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else for (const l of listeners) l(msg);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  async function newPage() {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    await Promise.all([s("Page.enable"), s("Runtime.enable"), s("Network.enable"), s("Log.enable")]);
    const consoleErrors = [];
    listeners.add((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === "Runtime.exceptionThrown") consoleErrors.push(m.params.exceptionDetails.exception?.description?.split("\n")[0] ?? m.params.exceptionDetails.text);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
      }
      if (m.method === "Log.entryAdded" && m.params.entry.level === "error") consoleErrors.push(`${m.params.entry.text} ${m.params.entry.url ?? ""}`.slice(0, 300));
    });

    const evaluate = async (expression) => {
      const r = await s("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    const waitFor = async (expression, timeoutMs = 15000) => {
      const start = Date.now();
      for (;;) {
        try {
          const v = await evaluate(expression);
          if (v) return v;
        } catch {
          // page may be navigating
        }
        if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for: ${expression}`);
        await new Promise((r) => setTimeout(r, 150));
      }
    };
    const goto = async (url) => {
      await s("Page.navigate", { url });
      await waitFor("document.readyState === 'complete'");
      await new Promise((r) => setTimeout(r, 600)); // hydration
    };
    const click = (selector) => evaluate(`(() => { const el = ${selector}; if (!el) throw new Error("not found: " + ${JSON.stringify(selector)}); el.click(); return true; })()`);
    // Focus a field and type like a user (fires React's input handlers).
    const type = async (selector, text) => {
      await evaluate(`(() => { const el = ${selector}; if (!el) throw new Error("not found"); el.focus(); el.select?.(); return true; })()`);
      await s("Input.insertText", { text });
    };
    const key = async (keyName, code, keyCode) => {
      await s("Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, windowsVirtualKeyCode: keyCode });
      await s("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: keyCode });
    };
    const viewport = (width, height = 800) => s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    const setCookies = (cookies) => s("Network.setCookies", { cookies });
    const clearCookies = () => s("Network.clearBrowserCookies");
    const url = () => evaluate("location.href");
    return { s, evaluate, waitFor, goto, click, type, key, viewport, setCookies, clearCookies, url, consoleErrors };
  }

  const version2 = version.Browser;
  async function close() {
    ws.close();
    proc.kill();
    await new Promise((r) => setTimeout(r, 500));
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // profile files may still be locked briefly on Windows
    }
  }
  return { newPage, close, version: version2 };
}

// "$(q)" helpers for selectors used with click/type.
export const q = (css) => `document.querySelector(${JSON.stringify(css)})`;
export const byText = (tag, text) =>
  `[...document.querySelectorAll(${JSON.stringify(tag)})].find((e) => e.textContent.trim().includes(${JSON.stringify(text)}))`;
