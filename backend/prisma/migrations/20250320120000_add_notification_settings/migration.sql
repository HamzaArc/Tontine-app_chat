-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "pushRemindersEnabled" BOOLEAN NOT NULL DEFAULT true;