-- Add daily email preference fields to UserPreference
ALTER TABLE "UserPreference" ADD COLUMN "dailyEmailEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserPreference" ADD COLUMN "dailyEmailTime" TEXT NOT NULL DEFAULT '08:00';

-- Create DailyEmailLog for deduplication
CREATE TABLE "DailyEmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyEmailLog_userId_dateKey_key" ON "DailyEmailLog"("userId", "dateKey");
CREATE INDEX "DailyEmailLog_userId_idx" ON "DailyEmailLog"("userId");

ALTER TABLE "DailyEmailLog" ADD CONSTRAINT "DailyEmailLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyEmailLog" ADD CONSTRAINT "DailyEmailLog_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
