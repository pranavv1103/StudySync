-- CreateEnum: GoalDifficulty
DO $$ BEGIN
  CREATE TYPE "GoalDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add difficulty column to PlannedGoal with default MEDIUM
ALTER TABLE "PlannedGoal" ADD COLUMN IF NOT EXISTS "difficulty" "GoalDifficulty" NOT NULL DEFAULT 'MEDIUM';
