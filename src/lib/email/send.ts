import "server-only";

export interface SendEmailResult {
  sent: boolean;
  reason?: "not_configured" | "provider_error";
}

// Best-effort transactional email via Resend. If no API key is configured,
// this is a no-op that reports its state honestly instead of pretending to
// have sent anything - callers must never let this failure block a DB write
// that already succeeded (e.g. a registration).
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not configured - skipped email to ${params.to}: ${params.subject}`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    // RESEND_API_URL exists only so tests can point delivery at a local mock;
    // production uses Resend's real endpoint.
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "no-reply@example.com",
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      console.error(`[email] Resend responded ${res.status} for ${params.to}`);
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] failed to send", err);
    return { sent: false, reason: "provider_error" };
  }
}
