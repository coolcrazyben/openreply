import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EMAIL_CAPTURE_PROMPT,
  extractEmail,
  isWithinMessagingWindow,
  maskEmail,
  maskEmailsInText,
  messagingWindowStart,
  MESSAGING_WINDOW_MS,
  withEmailCapturePrompt,
} from "@/lib/automation/email-capture";
import { subscribeToBeehiiv } from "@/lib/beehiiv/client";

describe("extractEmail", () => {
  it("finds an email inside a sentence, trimmed and lowercased", () => {
    expect(extractEmail("  sure, it's Pete.Peebles+IG@Gmail.COM thanks!")).toBe(
      "pete.peebles+ig@gmail.com"
    );
  });

  it("ignores trailing punctuation", () => {
    expect(extractEmail("my email is a@b.co.")).toBe("a@b.co");
    expect(extractEmail("(name@example.org)")).toBe("name@example.org");
  });

  it("returns the first valid email when there are several", () => {
    expect(extractEmail("x..y@bad.com or good@site.io")).toBe("good@site.io");
  });

  it.each([
    ["no email here", null],
    ["", null],
    [null, null],
    ["@handle on instagram", null],
    ["name@localhost", null],
    ["name@domain.c", null],
    ["name.@example.com", null],
    [".name@example.com", null],
    ["a..b@example.com", null],
    ["name@-example.com", null],
    ["name@example.123", null],
  ])("rejects %j", (text, expected) => {
    expect(extractEmail(text)).toBe(expected);
  });

  it("rejects addresses that are too long", () => {
    expect(extractEmail(`${"a".repeat(65)}@example.com`)).toBeNull();
  });
});

describe("maskEmail", () => {
  it("keeps the first character and the domain", () => {
    expect(maskEmail("pete@gmail.com")).toBe("p***@gmail.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });

  it("never returns the input for malformed values", () => {
    expect(maskEmail("@gmail.com")).toBe("***");
    expect(maskEmail("nope")).toBe("***");
  });

  it("masks every email inside a message", () => {
    expect(maskEmailsInText("it's Pete@Gmail.com or p2@x.io")).toBe(
      "it's p***@gmail.com or p***@x.io"
    );
  });
});

describe("messaging window", () => {
  const now = new Date("2026-10-29T12:00:00.000Z");

  it("accepts a DM sent within the last 24 hours", () => {
    expect(isWithinMessagingWindow(new Date(now.getTime() - 60_000), now)).toBe(true);
    expect(
      isWithinMessagingWindow(new Date(now.getTime() - MESSAGING_WINDOW_MS), now)
    ).toBe(true);
  });

  it("rejects older, missing or future timestamps", () => {
    expect(
      isWithinMessagingWindow(new Date(now.getTime() - MESSAGING_WINDOW_MS - 1), now)
    ).toBe(false);
    expect(isWithinMessagingWindow(null, now)).toBe(false);
    expect(isWithinMessagingWindow(new Date(now.getTime() + 1000), now)).toBe(false);
  });

  it("starts the window 24 hours ago", () => {
    expect(messagingWindowStart(now).toISOString()).toBe(
      "2026-10-28T12:00:00.000Z"
    );
  });
});

describe("withEmailCapturePrompt", () => {
  it("leaves the message alone when capture is off", () => {
    const automation = { dmMessage: "Here you go", emailCaptureEnabled: false };
    expect(withEmailCapturePrompt(automation)).toBe(automation);
  });

  it("appends the custom prompt, or the default when blank", () => {
    expect(
      withEmailCapturePrompt({
        dmMessage: "Here you go",
        emailCaptureEnabled: true,
        emailCapturePrompt: "Or reply with your email",
      }).dmMessage
    ).toBe("Here you go\n\nOr reply with your email");
    expect(
      withEmailCapturePrompt({
        dmMessage: "Here you go",
        emailCaptureEnabled: true,
        emailCapturePrompt: "  ",
      }).dmMessage
    ).toBe(`Here you go\n\n${DEFAULT_EMAIL_CAPTURE_PROMPT}`);
  });
});

describe("subscribeToBeehiiv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("subscribes with the welcome email and Instagram attribution", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "test-key");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "pub_test");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await subscribeToBeehiiv({ email: "a@b.co", utmCampaign: "ledger" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.beehiiv.com/v2/publications/pub_test/subscriptions"
    );
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toEqual({
      email: "a@b.co",
      reactivate_existing: false,
      send_welcome_email: true,
      utm_source: "instagram",
      utm_medium: "dm",
      utm_campaign: "ledger",
      referring_site: "instagram",
    });
  });

  it("reports only the HTTP status on failure", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "test-key");
    vi.stubEnv("BEEHIIV_PUBLICATION_ID", "pub_test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"errors":[{"message":"a@b.co is invalid"}]}', {
          status: 400,
        })
      )
    );

    await expect(
      subscribeToBeehiiv({ email: "a@b.co", utmCampaign: "ledger" })
    ).rejects.toThrow("beehiiv request failed (HTTP 400)");
  });

  it("fails without calling the API when it is not configured", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      subscribeToBeehiiv({ email: "a@b.co", utmCampaign: "ledger" })
    ).rejects.toThrow("BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
