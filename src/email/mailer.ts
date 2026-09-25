import type { EmailMessage } from "./templates";

export type EmailRecipient = {
  userId?: string;
  email: string;
  name?: string | null;
};

export type MailResult = {
  to: string;
  ok: boolean;
  error?: unknown;
};

// §78: notifications are architected so extra channels (e.g. WhatsApp) can be
// plugged in later. Every channel consumes the same content produced by
// src/email/templates.ts and simply provides its own `send` implementation.
export type NotificationChannel = {
  send(input: { recipient: EmailRecipient; message: EmailMessage }): Promise<void>;
};

type Provider = "resend" | "brevo" | "log";

function resolveProvider(): Provider {
  const raw = process.env.EMAIL_PROVIDER?.toLowerCase() ?? "";
  if (raw === "resend" || raw === "brevo") return raw;
  return "log";
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || "EduSphere <noreply@edusphere.dev>";
}

function logSend(to: string, subject: string, mode: string): void {
  console.info(`[email:${mode}] to=${to} subject="${subject}"`);
}

const resend: NotificationChannel = {
  async send({ recipient, message }) {
    const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
    if (!apiKey) {
      logSend(recipient.email, message.subject, "resend-missing-key");
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: recipient.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend ${res.status}: ${await res.text()}`);
    }
    logSend(recipient.email, message.subject, "resend");
  },
};

const brevo: NotificationChannel = {
  async send({ recipient, message }) {
    const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
    if (!apiKey) {
      logSend(recipient.email, message.subject, "brevo-missing-key");
      return;
    }
    const from = fromAddress().match(/^(.+) <(.+)>$/);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: from?.[2] ?? fromAddress(),
          name: from?.[1] ?? "EduSphere",
        },
        to: [{ email: recipient.email, name: recipient.name ?? undefined }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Brevo ${res.status}: ${await res.text()}`);
    }
    logSend(recipient.email, message.subject, "brevo");
  },
};

const logChannel: NotificationChannel = {
  async send({ recipient, message }) {
    logSend(recipient.email, message.subject, "log");
  },
};

function channelFor(provider: Provider): NotificationChannel {
  switch (provider) {
    case "resend":
      return resend;
    case "brevo":
      return brevo;
    default:
      return logChannel;
  }
}

export async function sendEmail(
  recipient: EmailRecipient,
  message: EmailMessage,
): Promise<MailResult> {
  try {
    await channelFor(resolveProvider()).send({ recipient, message });
    return { to: recipient.email, ok: true };
  } catch (error) {
    console.error("[email] send failed", { to: recipient.email, error });
    return { to: recipient.email, ok: false, error };
  }
}

export async function sendEmails(
  recipients: EmailRecipient[],
  messageBuilder: (recipient: EmailRecipient) => EmailMessage,
): Promise<MailResult[]> {
  const results = await Promise.all(
    (recipients ?? []).map((recipient) =>
      sendEmail(recipient, messageBuilder(recipient)),
    ),
  );
  return results;
}