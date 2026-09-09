// Transactional email via Resend's HTTP API — plain `fetch`, no SDK, in
// keeping with the project's zero-dependency approach. Requires
// RESEND_API_KEY (and optionally RESEND_FROM) in the environment; see
// .env.example.

export function buildPasswordResetEmail(resetUrl: string): {
  subject: string;
  text: string;
} {
  return {
    subject: "Resetează-ți parola — Expense Splitter",
    text: `Ai cerut resetarea parolei contului tău Expense Splitter.

Apasă linkul de mai jos ca să-ți alegi o parolă nouă (valabil 1 oră):

${resetUrl}

Dacă nu ai cerut tu asta, ignoră acest email — parola ta rămâne neschimbată.`,
  };
}

// Throws on any failure (missing key, non-2xx from Resend) — callers decide
// whether/how to surface that (see requestPasswordReset, which swallows it
// so email delivery problems can't be used to probe which addresses have an
// account).
export async function sendEmail(
  to: string,
  subject: string,
  text: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set — can't send email.");
  }
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
