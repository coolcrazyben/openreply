// One-off: create the paused LEDGER campaign for @boxscore.data through the
// same schema and data builder as POST /api/automations, so tracked links and
// the report slug are created exactly as the dashboard would.
//
//   npx tsx --env-file=.env.production.local scripts/create-ledger-campaign.ts          # dry run
//   npx tsx --env-file=.env.production.local scripts/create-ledger-campaign.ts --apply  # create
//
// Never prints connection strings or other secrets.
import { prisma } from "@/lib/db/client";
import {
  buildAutomationCreateData,
  createAutomationSchema,
} from "@/lib/campaigns/create";
import { getCampaign } from "@/lib/integrations/campaigns";

const WORKSPACE_ID = "cmvtp2cnu000108jtoek73lsm";
const INSTAGRAM_ACCOUNT_ID = "cmvtp4c54000408jtypx3e4pn";
const NAME = "LEDGER – SEC vs Big Ten";

const input = createAutomationSchema.parse({
  name: NAME,
  goal: "newsletter signups",
  instagramAccountId: INSTAGRAM_ACCOUNT_ID,
  matchAnyPost: true,
  keywords: ["LEDGER", "ledgers", "leger", "ledgar"],
  wholeWordMatch: true,
  dmTriggerEnabled: true,
  publicReplyEnabled: true,
  publicReplyMessages: [
    "Sent 📊 check your DMs",
    "In your DMs 👀",
    "Just sent it, check your inbox 📬",
    "Done ✅ check your requests folder if you don't see it",
  ],
  openingDmEnabled: true,
  openingDmMessage:
    "Hey {username}! Here's the SEC vs. Big Ten ledger you asked for 📊\n\nEvery SEC and Big Ten team rated from 1,853 games, cross-checked against SP+, FPI and SRS.\n\nTap below and I'll send it over 👇",
  openingDmButtonLabel: "Send me the data",
  dmMessage:
    "Here you go 👇\n\nDrop your email on this page and the full dataset lands in your inbox right away, plus one data breakdown like this every week. Free.\n\n— boxscore.data",
  linkButtonLabel: "Get the dataset",
  trackedDestinationUrl:
    "https://www.thebizidea.com/subscribe?utm_source=instagram&utm_medium=dm&utm_campaign=ledger",
  requireFollow: false,
  followUpEnabled: false,
  isActive: false,
});

async function main() {
  const apply = process.argv.includes("--apply");

  const account = await prisma.instagramAccount.findFirst({
    where: { id: INSTAGRAM_ACCOUNT_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, username: true },
  });
  if (!account) throw new Error("Instagram account not found in workspace");

  const existing = await prisma.automation.findFirst({
    where: { workspaceId: WORKSPACE_ID, name: NAME },
    select: { id: true },
  });
  if (existing) {
    console.log(`Campaign already exists: ${existing.id} (nothing created)`);
    return;
  }

  const data = buildAutomationCreateData(input, {
    workspaceId: WORKSPACE_ID,
    instagramAccountId: account.id,
  });

  if (!apply) {
    console.log(`Dry run for @${account.username}. Would create:`);
    console.log(JSON.stringify(data, null, 2));
    console.log("Re-run with --apply to create it.");
    return;
  }

  const created = await prisma.automation.create({
    data,
    select: { id: true },
  });
  const saved = await getCampaign(
    { workspaceId: WORKSPACE_ID, keyId: "script", scopes: ["campaigns:read"] },
    created.id
  );
  console.log(JSON.stringify(saved, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
