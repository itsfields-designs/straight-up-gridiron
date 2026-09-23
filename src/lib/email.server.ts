import type { ReactElement } from "react";
import { render } from "@react-email/render";

/**
 * All outgoing Gridiron Gods email goes through Resend (connected as a
 * project connector and called through the Lovable connector gateway).
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export const EMAIL_FROM = "Gridiron Gods <noreply@duels.gridirongods.app>";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  element?: ReactElement;
  replyTo?: string;
  from?: string;
};

export async function sendEmail(input: SendEmailInput) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

  const html = input.html ?? (input.element ? await render(input.element) : undefined);
  const text =
    input.text ?? (input.element ? await render(input.element, { plainText: true }) : undefined);
  if (!html && !text) throw new Error("An email needs html or text content");

  const response = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: input.from ?? EMAIL_FROM,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Resend request failed [${response.status}]: ${body}`);
    throw new Error(`Email send failed [${response.status}]: ${body}`);
  }

  return (await response.json()) as { id?: string };
}
