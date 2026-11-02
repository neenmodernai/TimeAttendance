// src/lib/mail.ts
import nodemailer from "nodemailer";

export const appUrl = () =>
  (process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");

export const mailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Sends through your Gmail (App Password). Returns false instead of throwing so a mail problem never blocks punching/leave. */
export async function sendMail(to: string | string[], subject: string, html: string): Promise<boolean> {
  const recipients = (Array.isArray(to) ? to : to.split(/[,;\s]+/)).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  if (!mailConfigured() || recipients.length === 0) return false;
  try {
    const t = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await t.sendMail({ from: `"ระบบลงเวลา" <${process.env.GMAIL_USER}>`, to: recipients.join(","), subject, html });
    return true;
  } catch (e) {
    console.error("sendMail failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

export const btn = (href: string, label: string, color: string) =>
  `<a href="${esc(href)}" style="display:inline-block;padding:12px 22px;margin:4px 6px 4px 0;background:${color};color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${esc(label)}</a>`;
export const wrap = (inner: string) =>
  `<div style="font-family:'Noto Sans Thai',Tahoma,sans-serif;max-width:560px;margin:auto;padding:16px;color:#1e293b">${inner}</div>`;
