import { Resend } from "resend";

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  return new Resend(apiKey);
}

export function getEmailFrom() {
  const from = process.env.AUTH_EMAIL_FROM;
  if (!from) throw new Error("Missing AUTH_EMAIL_FROM");
  return from;
}
