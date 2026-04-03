-- AlterTable
ALTER TABLE "User"
  ALTER COLUMN "password" DROP NOT NULL,
  ADD COLUMN "googleId" TEXT,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "remindSelfPendingGoals" BOOLEAN NOT NULL DEFAULT true,
    "remindPartnerPendingGoals" BOOLEAN NOT NULL DEFAULT true,
    "middayReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "eveningReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "middayReminderTime" TEXT NOT NULL DEFAULT '14:00',
    "eveningReminderTime" TEXT NOT NULL DEFAULT '19:00',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT NOT NULL DEFAULT '22:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '07:00',
    "browserNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notifyWhenPartnerBehind" BOOLEAN NOT NULL DEFAULT true,
    "notifyWhenPartnerCompletedAll" BOOLEAN NOT NULL DEFAULT true,
    "notifyWhenSelfCompletedAll" BOOLEAN NOT NULL DEFAULT true,
    "realtimePartnerUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_workspaceId_idx" ON "UserPreference"("workspaceId");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
