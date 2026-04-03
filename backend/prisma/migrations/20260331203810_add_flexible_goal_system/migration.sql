-- CreateEnum
CREATE TYPE "GoalUnit" AS ENUM ('PROBLEMS', 'JOBS', 'TOPICS', 'HOURS', 'TASKS', 'VIDEOS', 'APPLICATIONS', 'SESSIONS', 'MINUTES', 'ITEMS');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "GoalTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" "GoalUnit" NOT NULL,
    "defaultTargetValue" INTEGER NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" "GoalUnit" NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "sourceTemplateId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recurringGoalId" TEXT,

    CONSTRAINT "PlannedGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalProgress" (
    "id" TEXT NOT NULL,
    "plannedGoalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "completedValue" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalCopyHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceDate" TIMESTAMP(3) NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "goalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalCopyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" "GoalUnit" NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'NONE',
    "recurrenceDays" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoalTemplate_workspaceId_active_idx" ON "GoalTemplate"("workspaceId", "active");

-- CreateIndex
CREATE INDEX "GoalTemplate_userId_idx" ON "GoalTemplate"("userId");

-- CreateIndex
CREATE INDEX "PlannedGoal_workspaceId_date_idx" ON "PlannedGoal"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "PlannedGoal_userId_date_idx" ON "PlannedGoal"("userId", "date");

-- CreateIndex
CREATE INDEX "PlannedGoal_workspaceId_status_idx" ON "PlannedGoal"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedGoal_userId_workspaceId_date_title_key" ON "PlannedGoal"("userId", "workspaceId", "date", "title");

-- CreateIndex
CREATE INDEX "GoalProgress_workspaceId_userId_idx" ON "GoalProgress"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalProgress_plannedGoalId_key" ON "GoalProgress"("plannedGoalId");

-- CreateIndex
CREATE INDEX "GoalCopyHistory_workspaceId_userId_idx" ON "GoalCopyHistory"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "RecurringGoal_workspaceId_active_idx" ON "RecurringGoal"("workspaceId", "active");

-- CreateIndex
CREATE INDEX "RecurringGoal_userId_idx" ON "RecurringGoal"("userId");

-- AddForeignKey
ALTER TABLE "GoalTemplate" ADD CONSTRAINT "GoalTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalTemplate" ADD CONSTRAINT "GoalTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedGoal" ADD CONSTRAINT "PlannedGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedGoal" ADD CONSTRAINT "PlannedGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedGoal" ADD CONSTRAINT "PlannedGoal_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "GoalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedGoal" ADD CONSTRAINT "PlannedGoal_recurringGoalId_fkey" FOREIGN KEY ("recurringGoalId") REFERENCES "RecurringGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProgress" ADD CONSTRAINT "GoalProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProgress" ADD CONSTRAINT "GoalProgress_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProgress" ADD CONSTRAINT "GoalProgress_plannedGoalId_fkey" FOREIGN KEY ("plannedGoalId") REFERENCES "PlannedGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalCopyHistory" ADD CONSTRAINT "GoalCopyHistory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringGoal" ADD CONSTRAINT "RecurringGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringGoal" ADD CONSTRAINT "RecurringGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
