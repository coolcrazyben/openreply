// Minimal beehiiv API client: subscribe an email captured in a DM.
// Needs BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID on the worker.

export class BeehiivApiError extends Error {
  constructor(
    readonly status: number | null,
    message: string
  ) {
    super(message);
    this.name = "BeehiivApiError";
  }
}

export function isBeehiivConfigured(): boolean {
  return Boolean(
    process.env.BEEHIIV_API_KEY?.trim() &&
      process.env.BEEHIIV_PUBLICATION_ID?.trim()
  );
}

/**
 * Subscribe an email to the publication and let beehiiv send its welcome
 * email. Subscribing an address that is already on the list is not an error,
 * so a retry after an ambiguous failure is harmless.
 */
export async function subscribeToBeehiiv({
  email,
  utmCampaign,
}: {
  email: string;
  utmCampaign: string;
}): Promise<void> {
  const apiKey = process.env.BEEHIIV_API_KEY?.trim();
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID?.trim();
  if (!apiKey || !publicationId) {
    throw new BeehiivApiError(
      null,
      "BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID is not set"
    );
  }

  const response = await fetch(
    `https://api.beehiiv.com/v2/publications/${encodeURIComponent(publicationId)}/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        reactivate_existing: false,
        send_welcome_email: true,
        utm_source: "instagram",
        utm_medium: "dm",
        utm_campaign: utmCampaign,
        referring_site: "instagram",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }
  ).catch(() => {
    throw new BeehiivApiError(null, "beehiiv request failed (network)");
  });

  // Only the status is kept: response bodies can echo the subscriber's email.
  if (!response.ok) {
    throw new BeehiivApiError(
      response.status,
      `beehiiv request failed (HTTP ${response.status})`
    );
  }
}
