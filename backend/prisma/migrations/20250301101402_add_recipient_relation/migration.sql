-- AlterTable
ALTER TABLE "Cycle" ADD COLUMN     "recipientUserId" INTEGER;

-- AddForeignKey
ALTER TABLE "Cycle" ADD CONSTRAINT "Cycle_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
