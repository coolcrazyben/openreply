import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";
import { buildInitialCampaignLinks } from "@/lib/campaigns/links";
import { generateReportShareSlug } from "@/lib/reports/share";

export const createAutomationSchema = z
  .object({
    name: z.string().min(1).max(100),
    goal: z.string().min(1).max(120).optional().nullable(),
    instagramAccountId: z.string().min(1).optional().nullable(),
    postId: z.string().min(1).optional().nullable(),
    postUrl: z.string().url().optional().nullable(),
    pendingNextReel: z.boolean().optional().default(false),
    matchAnyPost: z.boolean().optional().default(false),
    keywords: z.array(z.string().min(1).max(50)).max(10).optional().default([]),
    matchAnyWord: z.boolean().optional().default(false),
    dmTriggerEnabled: z.boolean().optional().default(false),
    dmMessage: z.string().min(1).max(1000),
    openingDmEnabled: z.boolean().optional().default(false),
    openingDmMessage: z.string().max(1000).optional().nullable(),
    openingDmButtonLabel: z.string().max(64).optional().nullable(),
    linkButtonLabel: z.string().max(20).optional().nullable(),
    requireFollow: z.boolean().optional().default(false),
    followPromptMessage: z.string().max(1000).optional().nullable(),
    followPromptButtonLabel: z.string().max(20).optional().nullable(),
    followUpEnabled: z.boolean().optional().default(false),
    followUpMessage: z.string().max(1000).optional().nullable(),
    // Minutes to wait before the follow-up. Capped at 24h so it stays inside
    // Instagram's messaging window.
    followUpDelayMinutes: z.number().int().min(0).max(1440).optional().default(0),
    publicReplyEnabled: z.boolean().optional().default(false),
    publicReplyMessage: z.string().max(1000).optional().nullable(),
    publicReplyMessages: z
      .array(z.string().max(1000))
      .max(10)
      .optional()
      .default([]),
    // Empty string means "no tracked link"; a URL sets one.
    trackedDestinationUrl: z
      .union([z.string().url(), z.literal("")])
      .optional()
      .nullable(),
    // Optional second tracked link, rendered as a second DM button.
    secondaryDestinationUrl: z
      .union([z.string().url(), z.literal("")])
      .optional()
      .nullable(),
    secondaryButtonLabel: z.string().max(20).optional().nullable(),
    isActive: z.boolean().optional().default(true),
    wholeWordMatch: z.boolean().optional().default(true),
    // Reply-with-your-email capture. Empty messages fall back to the defaults.
    emailCaptureEnabled: z.boolean().optional().default(false),
    emailCapturePrompt: z.string().max(500).optional().nullable(),
    emailCaptureSuccessMessage: z.string().max(1000).optional().nullable(),
    emailCaptureInvalidMessage: z.string().max(1000).optional().nullable(),
  })
  // A campaign must target a specific post, any post, or the next reel.
  .refine(
    (d) => d.matchAnyPost || d.pendingNextReel || Boolean(d.postId),
    { message: "Choose which post(s) trigger the campaign", path: ["postId"] }
  )
  // And it must match either specific words or any word.
  .refine((d) => d.matchAnyWord || d.keywords.length >= 1, {
    message: "Add at least one keyword, or match any word",
    path: ["keywords"],
  })
  // An opening DM needs both a message and a button label.
  .refine(
    (d) =>
      !d.openingDmEnabled ||
      (Boolean(d.openingDmMessage?.trim()) &&
        Boolean(d.openingDmButtonLabel?.trim())),
    { message: "Opening DM needs a message and a button label", path: ["openingDmMessage"] }
  );

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;

/**
 * The `prisma.automation.create` data for a validated new campaign, including
 * its tracked links and report share slug. Shared by the API route and
 * one-off scripts so both create campaigns the same way.
 */
export function buildAutomationCreateData(
  input: CreateAutomationInput,
  {
    workspaceId,
    instagramAccountId,
  }: { workspaceId: string; instagramAccountId: string }
) {
  const linkCreates = buildInitialCampaignLinks({
    workspaceId,
    primaryUrl: input.trackedDestinationUrl,
    secondaryUrl: input.secondaryDestinationUrl,
    secondaryLabel: input.secondaryButtonLabel,
  });

  const { pendingNextReel, matchAnyPost, matchAnyWord, openingDmEnabled } =
    input;
  // A post is only stored for the "specific post" trigger.
  const isSpecificPost = !pendingNextReel && !matchAnyPost;
  const publicReplyList = (
    input.publicReplyMessages.length > 0
      ? input.publicReplyMessages
      : input.publicReplyMessage
        ? [input.publicReplyMessage]
        : []
  )
    .map((m) => m.trim())
    .filter(Boolean);

  return {
    name: input.name,
    goal: input.goal,
    // A next-reel campaign has no post yet; the cron binds it once a reel is posted.
    postId: isSpecificPost ? input.postId : null,
    postUrl: isSpecificPost ? input.postUrl : null,
    pendingNextReel,
    matchAnyPost,
    keywords: matchAnyWord ? [] : input.keywords,
    matchAnyWord,
    dmTriggerEnabled: input.dmTriggerEnabled,
    dmMessage: input.dmMessage,
    openingDmEnabled,
    openingDmMessage: openingDmEnabled
      ? input.openingDmMessage || null
      : null,
    openingDmButtonLabel: openingDmEnabled
      ? input.openingDmButtonLabel || null
      : null,
    linkButtonLabel: input.linkButtonLabel || null,
    requireFollow: input.requireFollow,
    followPromptMessage: input.requireFollow
      ? input.followPromptMessage || null
      : null,
    followPromptButtonLabel: input.requireFollow
      ? input.followPromptButtonLabel || null
      : null,
    followUpEnabled: input.followUpEnabled,
    followUpMessage: input.followUpEnabled
      ? input.followUpMessage || null
      : null,
    followUpDelayMinutes: input.followUpEnabled
      ? input.followUpDelayMinutes
      : 0,
    publicReplyEnabled: input.publicReplyEnabled,
    publicReplyMessages: input.publicReplyEnabled
      ? publicReplyList
      : [],
    publicReplyMessage: input.publicReplyEnabled
      ? publicReplyList[0] ?? input.publicReplyMessage ?? null
      : null,
    isActive: input.isActive,
    wholeWordMatch: input.wholeWordMatch,
    emailCaptureEnabled: input.emailCaptureEnabled,
    emailCapturePrompt: input.emailCaptureEnabled
      ? input.emailCapturePrompt?.trim() || null
      : null,
    emailCaptureSuccessMessage: input.emailCaptureEnabled
      ? input.emailCaptureSuccessMessage?.trim() || null
      : null,
    emailCaptureInvalidMessage: input.emailCaptureEnabled
      ? input.emailCaptureInvalidMessage?.trim() || null
      : null,
    workspaceId,
    instagramAccountId,
    reportShareSlug: generateReportShareSlug(),
    ...(linkCreates.length > 0
      ? { trackedLinks: { create: linkCreates } }
      : {}),
  } satisfies Prisma.AutomationUncheckedCreateInput;
}
