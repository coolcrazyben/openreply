-- Email capture inside the DM: additive, nullable or defaulted columns only,
-- so existing campaigns keep their behaviour (capture off). IF NOT EXISTS makes
-- each statement safe to re-run if a deploy is interrupted.

-- AlterTable
ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "emailCaptureEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "emailCapturePrompt" TEXT;
ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "emailCaptureSuccessMessage" TEXT;
ALTER TABLE "Automation" ADD COLUMN IF NOT EXISTS "emailCaptureInvalidMessage" TEXT;
