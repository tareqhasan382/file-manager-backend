import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import config from "../config";

const resend = new Resend(config.resend.apiKey);

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  if (!config.resend.apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const payload = {
    from: config.resend.from,
    to,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  } as CreateEmailOptions;

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    throw new Error(error.message || "Failed to send email");
  }

  console.log("<---------------------Send message successfully.---------------------->");
  return data;
}
