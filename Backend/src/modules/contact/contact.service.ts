import { ContactSubmission, type ContactSubmissionDoc } from "../../models/contactSubmission.model.js";
import { getMailDriver } from "../../lib/mail.js";
import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";

export interface CreateContactInput {
  name: string;
  email: string;
  company?: string | null;
  message: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ContactSubmissionResponseShape {
  id: string;
  receivedAt: Date;
}

/** Where the inbound notification gets emailed. Falls back to MAIL_FROM if
 *  the dedicated INBOX_TO env var isn't set so a fresh setup still works. */
function notificationRecipient(): string {
  return process.env.CONTACT_INBOX_TO ?? config.MAIL_FROM;
}

function buildNotificationBody(doc: ContactSubmissionDoc): {
  text: string;
  html: string;
} {
  const text = [
    "New contact-form submission",
    "============================",
    `Name:    ${doc.name}`,
    `Email:   ${doc.email}`,
    `Company: ${doc.company ?? "—"}`,
    "",
    "Message:",
    doc.message,
    "",
    "----",
    `Submission ID: ${doc._id.toString()}`,
    `IP:            ${doc.ipAddress ?? "(unknown)"}`,
    `User agent:    ${doc.userAgent ?? "(unknown)"}`,
    `Received at:   ${doc.createdAt.toISOString()}`,
  ].join("\n");

  const safeMessage = doc.message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#1f2937;">
  <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">New contact-form submission</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#6b7280;width:90px;">Name</td><td><strong>${doc.name}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td><a href="mailto:${doc.email}">${doc.email}</a></td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Company</td><td>${doc.company ?? "—"}</td></tr>
  </table>
  <div style="margin-top:18px;padding:14px 16px;background:#f9fafb;border-radius:8px;font-size:14px;line-height:1.55;white-space:pre-wrap;">${safeMessage}</div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;" />
  <p style="margin:0;font-size:12px;color:#9ca3af;">
    Submission ID: ${doc._id.toString()} · IP: ${doc.ipAddress ?? "—"}<br>
    Received: ${doc.createdAt.toISOString()}
  </p>
</div>`.trim();

  return { text, html };
}

export async function createContactSubmission(
  input: CreateContactInput,
): Promise<ContactSubmissionResponseShape> {
  const doc = await ContactSubmission.create({
    name: input.name,
    email: input.email,
    company: input.company && input.company.trim().length > 0 ? input.company.trim() : null,
    message: input.message,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });

  // Best-effort notification — never let an SMTP outage 500 the public form.
  // The submission is already persisted, so the row + the response is
  // ground truth. A daemon could later resend any rows where notifiedAt is
  // still null.
  try {
    const { text, html } = buildNotificationBody(doc);
    await getMailDriver().send({
      to: notificationRecipient(),
      subject: `[Contact] ${doc.name} — ${doc.company ?? "no company"}`,
      text,
      html,
      // Set the visitor's email as Reply-To so a one-click reply from the
      // recipient mailbox lands back in their inbox without retyping.
      replyTo: doc.email,
    });
    doc.notifiedAt = new Date();
    await doc.save();
  } catch (err) {
    logger.warn(
      { err, submissionId: doc._id.toString() },
      "contact.createContactSubmission notification email failed",
    );
  }

  return { id: doc._id.toString(), receivedAt: doc.createdAt };
}
