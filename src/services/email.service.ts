import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env';

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = (process.env.SMTP_HOST ?? '').trim();
  const port = Number(process.env.SMTP_PORT ?? '587');
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = (process.env.SMTP_PASS ?? '').trim();

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user, pass },
    });
  } else {
    // Dev / staging: log-only transport (sheet 473 still works end-to-end).
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  return transporter;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    (process.env.SMTP_HOST ?? '').trim() &&
      (process.env.SMTP_USER ?? '').trim() &&
      (process.env.SMTP_PASS ?? '').trim(),
  );
}

/**
 * Central email notification service (sheet 473).
 * Never throws to callers — logs and returns delivery status.
 */
export async function sendEmail(payload: EmailPayload): Promise<{
  delivered: boolean;
  mode: 'smtp' | 'log';
  messageId?: string;
}> {
  const to = payload.to.trim();
  if (!to || !to.includes('@')) {
    return { delivered: false, mode: isSmtpConfigured() ? 'smtp' : 'log' };
  }

  const from =
    (process.env.SMTP_FROM ?? '').trim() ||
    `noreply@${env.nodeEnv === 'production' ? 'workindia.in' : 'localhost'}`;

  try {
    const info = await getTransporter().sendMail({
      from,
      to,
      subject: payload.subject.slice(0, 200),
      text: payload.text.slice(0, 10000),
      html: payload.html?.slice(0, 20000),
    });

    const mode = isSmtpConfigured() ? 'smtp' : 'log';
    if (mode === 'log') {
      console.info(
        `[email:log] to=${to} subject=${payload.subject} id=${info.messageId ?? 'n/a'}`,
      );
    }

    return {
      delivered: true,
      mode,
      messageId: typeof info.messageId === 'string' ? info.messageId : undefined,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.error(`[email] failed to=${to}: ${reason}`);
    return { delivered: false, mode: isSmtpConfigured() ? 'smtp' : 'log' };
  }
}

export const emailService = { sendEmail, isSmtpConfigured };
