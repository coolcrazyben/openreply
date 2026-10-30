// Email capture inside the DM: someone the campaign has messaged replies with
// their email address, and it is subscribed to the newsletter for them.

export const DEFAULT_EMAIL_CAPTURE_PROMPT =
  "Or just reply with your email and I'll send it straight to your inbox 📬";
export const DEFAULT_EMAIL_CAPTURE_SUCCESS_MESSAGE =
  "You're in ✅ Check your inbox for the dataset, it should land in a minute.";
export const DEFAULT_EMAIL_CAPTURE_INVALID_MESSAGE =
  "Hmm, I couldn't find an email in that. Reply with just your email (like name@example.com) and I'll send it over 📬";
export const EMAIL_CAPTURE_FAILURE_MESSAGE =
  "Sorry, I couldn't sign you up automatically. You can grab it here instead:";

// Instagram only lets a business message someone within 24 hours of their
// last message, so a capture attempt is only recognised inside that window.
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

// Strict on purpose: a false positive subscribes an address nobody owns. The
// local part allows the common unquoted characters; the domain needs at least
// one dot and an alphabetic TLD. Lookarounds stop it from matching inside a
// longer run of address characters.
const EMAIL_PATTERN =
  /(?<![a-z0-9._%+-])[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9_%+-])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?![a-z0-9-])/gi;

/**
 * The first plausible email address in a message, trimmed and lowercased, or
 * null if there is none.
 */
export function extractEmail(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const match of text.matchAll(EMAIL_PATTERN)) {
    const email = match[0].trim().toLowerCase();
    const [local] = email.split("@");
    if (email.length > 254 || local.length > 64 || local.includes("..")) {
      continue;
    }
    return email;
  }
  return null;
}

/** "pete@gmail.com" → "p***@gmail.com", safe to put in logs. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/** Replace every email address in a text with its masked form. */
export function maskEmailsInText(text: string): string {
  return text.replace(EMAIL_PATTERN, (email) => maskEmail(email.toLowerCase()));
}

export function messagingWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - MESSAGING_WINDOW_MS);
}

export function isWithinMessagingWindow(
  sentAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!sentAt) return false;
  const age = now.getTime() - sentAt.getTime();
  return age >= 0 && age <= MESSAGING_WINDOW_MS;
}

type PromptFields = {
  dmMessage: string;
  emailCaptureEnabled?: boolean | null;
  emailCapturePrompt?: string | null;
};

/**
 * The campaign with the email-capture prompt appended to its link DM, so the
 * reveal offers "or just reply with your email". Unchanged when capture is off.
 */
export function withEmailCapturePrompt<T extends PromptFields>(automation: T): T {
  if (!automation.emailCaptureEnabled) return automation;
  const prompt =
    automation.emailCapturePrompt?.trim() || DEFAULT_EMAIL_CAPTURE_PROMPT;
  return { ...automation, dmMessage: `${automation.dmMessage}\n\n${prompt}` };
}
